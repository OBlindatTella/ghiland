'use client';

import { memo, useEffect, useContext, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BasicShadowMap, PCFSoftShadowMap } from 'three';
import { Bloom, EffectComposer, EffectComposerContext, SMAA, ToneMapping } from '@react-three/postprocessing';
import { COMPOSER_TONE_MODE, readComposerTone } from '@/engine/quality/toneState';
import { composerGpuBytes, defaultFramebufferBytes, releaseComposerTargets, samplesWithinBudget, shadowMapBytes, trackGpuBytes, trackedGpuBytes, type ComposerBuffers } from '@/engine/quality/gpuMemory';
import { estimateTextureBytes } from '@/worlds/seaside-house/art/textures';
import { textureSizeForTier } from '@/worlds/seaside-house/art/scale';
import { readFps } from '@/engine/quality/fakeFps';
import { bus } from '@/engine/events/bus';
import { heuristicTier, initialAutoClock, stepAutoQuality, ceilingStillValid, type AutoClock } from '@/engine/quality/autoQuality';
import { qualityProfiles } from '@/engine/quality/profiles';
import type { QualityProfile } from '@/contracts/quality';
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
  const rendererName = useRef('');

  useEffect(() => {
    const debug = gl.getContext().getExtension('WEBGL_debug_renderer_info');
    const nav = navigator as Navigator & { deviceMemory?: number };
    const renderer = debug ? String(gl.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
    rendererName.current = renderer;
    const settings = useSettings.getState();
    const now = Date.now();
    const ceiling = ceilingStillValid(settings.autoCeiling, renderer, now);
    const tier = heuristicTier({
      renderer,
      cores: navigator.hardwareConcurrency || 4,
      deviceMemory: nav.deviceMemory,
      lastGood: settings.lastAutoTier,
      ceiling: settings.autoCeiling,
      now,
    });
    usePerfStore.getState().setAutoTier(tier);
    clock.current = initialAutoClock(tier, ceiling ?? 'ULTRA');
  }, [gl]);

  useEffect(() => {
    let generation = 0;
    let booted = false;
    const apply = () => {
      if (useGlStore.getState().lost && booted) return;
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
          if (useGlStore.getState().lost) return;
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
    const unsubGl = useGlStore.subscribe((state, prev) => {
      if (prev.lost && !state.lost) apply();
    });
    const unsubSettings = useSettings.subscribe((state, prev) => {
      const selected = state.qualityEpoch !== prev.qualityEpoch;
      if (state.quality === prev.quality && !selected) return;
      // A manual tier, or choosing AUTO again, clears the session ceiling (D-034).
      const tier = state.quality === 'AUTO' ? usePerfStore.getState().autoTier : state.quality;
      clock.current = initialAutoClock(tier, 'ULTRA');
      apply();
    });
    const unsubPerf = usePerfStore.subscribe((state, prev) => {
      if (state.autoTier !== prev.autoTier) apply();
    });
    const unsubSession = useSession.subscribe((state, prev) => {
      if (state.forceLow !== prev.forceLow) apply();
    });
    return () => {
      generation += 1;
      unsubGl();
      unsubSettings();
      unsubPerf();
      unsubSession();
    };
  }, []);

  useEffect(() => trackGpuBytes(shadowMapBytes(profile.shadowMapSize)), [profile.shadowMapSize]);

  useEffect(() => {
    gl.shadowMap.enabled = profile.shadows !== 'off';
    // r186 resolves PCFSoftShadowMap to PCF. The enum is what the profile asks for.
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
    if (useSession.getState().worldPhase !== 'active') return;
    const sample = readFps(perfSample.fps);
    if (!sample.injected && sample.fps <= 0) return;
    const previousCeiling = clock.current.ceiling;
    const next = stepAutoQuality(clock.current, sample.fps, dt);
    clock.current = next;
    if (next.remember) {
      const tier = next.remember;
      window.setTimeout(() => useSettings.getState().setLastAutoTier(tier), 0);
    }
    if (!next.changed) return;
    usePerfStore.getState().setAutoTier(next.tier);
    if (next.ceiling !== previousCeiling) {
      const ceiling = next.ceiling;
      const renderer = rendererName.current;
      window.setTimeout(() => {
        useSettings.getState().setAutoCeiling({ tier: ceiling, renderer, at: Date.now() });
      }, 0);
    }
  });

  return <FrozenPost profile={profile} />;
}

const MemoPost = memo(PostStack);

/**
 * While the context is lost the post stack unmounts, so its materials and render
 * targets release against the current program cache. After restore the key changes
 * and one new stack is built into the replacement cache.
 */
function FrozenPost({ profile }: { profile: QualityProfile }) {
  const lost = useGlStore((state) => state.lost);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    return useGlStore.subscribe((state, prev) => {
      if (prev.lost && !state.lost) setGeneration((value) => value + 1);
    });
  }, []);

  if (lost) return null;
  return <MemoPost key={generation} profile={profile} />;
}

/** SMAA on LOW/MED, bloom and MSAA on HIGH/ULTRA, AgX on every tier. */
export function PostStack({ profile }: { profile: QualityProfile }) {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const msaa =
    profile.multisampling === 0
      ? 0
      : samplesWithinBudget(profile.tier === 'ULTRA' ? 'ULTRA' : 'HIGH', {
          width: Math.max(1, Math.round(size.width * dpr)),
          height: Math.max(1, Math.round(size.height * dpr)),
          shadowMap: profile.shadowMapSize,
          textureBytes: estimateTextureBytes(textureSizeForTier(profile.tier)),
          bloom: profile.postprocessing.bloom,
        });
  const smaa = profile.postprocessing.smaa || msaa === 0;
  return (
    <EffectComposer multisampling={smaa ? 0 : msaa} enableNormalPass={false} autoClear>
      {smaa ? <SMAA /> : <Bloom intensity={0.12} luminanceThreshold={0.9} mipmapBlur />}
      <ToneMapping mode={COMPOSER_TONE_MODE} />
      <ComposerLifecycle />
    </EffectComposer>
  );
}

let liveComposer: {
  multisampling?: number;
  passes: readonly object[];
  inputBuffer: { width: number; height: number; samples?: number; depthBuffer?: boolean };
  outputBuffer: { width: number; height: number; samples?: number; depthBuffer?: boolean };
  depthRenderTarget?: { width: number; height: number; samples?: number } | null;
} | null = null;

export function readLiveComposer(rendererToneMapping: number) {
  if (!liveComposer) return null;
  return {
    ...readComposerTone({ toneMapping: rendererToneMapping }, liveComposer),
    targetBytes: composerGpuBytes(liveComposer),
  };
}

export function readTrackedGpuBytes(): number {
  return trackedGpuBytes();
}

/** Context loss and restore both ask. The React unmount asks again; the release is idempotent. */
export function releaseLiveComposer(): void {
  if (!liveComposer) return;
  releaseComposerTargets(liveComposer as unknown as ComposerBuffers);
}

function ComposerLifecycle() {
  const { composer } = useContext(EffectComposerContext);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  useEffect(() => {
    liveComposer = composer;
    return () => {
      if (liveComposer === composer) liveComposer = null;
      releaseComposerTargets(composer);
    };
  }, [composer]);

  useEffect(() => {
    let release = () => {};
    const id = window.requestAnimationFrame(() => {
      if (useGlStore.getState().lost) return;
      composer.setSize(size.width, size.height);
      const pixelsWide = Math.max(1, Math.round(size.width * dpr));
      const pixelsHigh = Math.max(1, Math.round(size.height * dpr));
      release = trackGpuBytes(composerGpuBytes(composer) + defaultFramebufferBytes(pixelsWide, pixelsHigh));
    });
    return () => {
      window.cancelAnimationFrame(id);
      release();
    };
  }, [composer, size.width, size.height, dpr]);

  return null;
}
