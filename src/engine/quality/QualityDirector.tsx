'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BasicShadowMap, PCFSoftShadowMap } from 'three';
import { Bloom, EffectComposer, SMAA } from '@react-three/postprocessing';
import { bus } from '@/engine/events/bus';
import { heuristicTier, initialAutoClock, stepAutoQuality, type AutoClock } from '@/engine/quality/autoQuality';
import { qualityProfiles } from '@/engine/quality/profiles';
import { perfSample, usePerfStore } from '@/state/perf';
import { useAppliedQuality } from '@/state/appliedQuality';
import { useGlStore } from '@/state/gl';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';

function targetTier(): 'LOW' | 'MED' | 'HIGH' | 'ULTRA' {
  if (useSession.getState().forceLow) return 'LOW';
  const setting = useSettings.getState().quality;
  if (setting === 'AUTO') return usePerfStore.getState().autoTier;
  return setting;
}

export function QualityDirector() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const applied = useAppliedQuality((state) => state.tier);
  const profile = qualityProfiles[applied];
  const clock = useRef<AutoClock>(initialAutoClock('HIGH'));

  useEffect(() => {
    const debug = gl.getContext().getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? String(gl.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
    const nav = navigator as Navigator & { deviceMemory?: number };
    const tier = heuristicTier({
      renderer,
      cores: navigator.hardwareConcurrency || 4,
      deviceMemory: nav.deviceMemory,
      lastGood: useSettings.getState().lastAutoTier,
    });
    usePerfStore.getState().setAutoTier(tier);
    clock.current = initialAutoClock(tier);
  }, [gl]);

  useEffect(() => {
    let generation = 0;
    let booted = false;
    const apply = () => {
      const next = targetTier();
      const gen = ++generation;
      if (!booted) {
        booted = true;
        useAppliedQuality.getState().setTier(next);
        return;
      }
      if (useAppliedQuality.getState().tier === next) return;
      window.setTimeout(() => {
        if (gen !== generation) return;
        useAppliedQuality.getState().setDim(true);
        window.setTimeout(() => {
          if (gen !== generation) return;
          const resolved = targetTier();
          useAppliedQuality.getState().setTier(resolved);
          bus.emit('quality:changed', {
            tier: resolved,
            reason: useSettings.getState().quality === 'AUTO' ? 'auto' : 'user',
          });
          window.setTimeout(() => {
            if (gen === generation) useAppliedQuality.getState().setDim(false);
          }, 200);
        }, 200);
      }, 400);
    };
    apply();
    const unsubSettings = useSettings.subscribe((state, prev) => {
      if (state.quality !== prev.quality) apply();
    });
    const unsubPerf = usePerfStore.subscribe((state, prev) => {
      if (state.autoTier !== prev.autoTier) apply();
    });
    const unsubSession = useSession.subscribe((state, prev) => {
      if (state.forceLow !== prev.forceLow) apply();
    });
    return () => {
      generation += 1;
      unsubSettings();
      unsubPerf();
      unsubSession();
    };
  }, []);

  useEffect(() => {
    const dpr = Math.min(profile.dpr[1], Math.max(profile.dpr[0], window.devicePixelRatio || 1));
    gl.setPixelRatio(dpr);
    gl.shadowMap.enabled = profile.shadows !== 'off';
    gl.shadowMap.type = profile.shadows === 'soft' ? PCFSoftShadowMap : BasicShadowMap;
    gl.shadowMap.needsUpdate = true;
  }, [profile, gl]);

  useEffect(() => {
    const applyFov = (fovDeg: number) => {
      if (!('fov' in camera) || camera.fov === fovDeg) return;
      camera.fov = fovDeg;
      camera.updateProjectionMatrix();
    };
    applyFov(useSettings.getState().fovDeg);
    return useSettings.subscribe((state) => applyFov(state.fovDeg));
  }, [camera]);

  useFrame((_, dt) => {
    if (useSettings.getState().quality !== 'AUTO' || useGlStore.getState().lost) return;
    if (useSession.getState().worldPhase !== 'active' || perfSample.fps <= 0) return;
    const next = stepAutoQuality(clock.current, perfSample.fps, dt);
    clock.current = next;
    if (!next.changed) return;
    usePerfStore.getState().setAutoTier(next.tier);
    useSettings.getState().setLastAutoTier(next.tier);
  });

  if (profile.postprocessing.smaa) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false} autoClear>
        <SMAA />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={profile.multisampling} enableNormalPass={false} autoClear>
      <Bloom intensity={0.12} luminanceThreshold={0.9} mipmapBlur />
    </EffectComposer>
  );
}
