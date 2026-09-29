'use client';

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { AgXToneMapping } from 'three';
import { AudioRig } from '@/engine/audio/AudioRig';
import { installDevHook } from '@/engine/dev/installDevHook';
import { qualityProfiles } from '@/engine/quality/profiles';
import { useAppliedQuality } from '@/state/appliedQuality';
import { PerfProbe } from '@/engine/perf/PerfProbe';
import { ContextGuard } from '@/engine/quality/ContextGuard';
import { QualityDirector } from '@/engine/quality/QualityDirector';
import { SceneManager } from '@/engine/scene/SceneManager';
import { CrosshairRig } from '@/engine/windows/CrosshairRig';
import { WindowRig } from '@/engine/windows/WindowRig';
import { ExposureDirector } from '@/engine/environment/ExposureDirector';
import { useSession } from '@/state/session';

let canvasMounts = 0;

function CanvasLifecycle() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    canvasMounts += 1;
    installDevHook(() => canvasMounts, () => ({
      dpr: gl.getPixelRatio(),
      shadows: gl.shadowMap.enabled,
      fov: 'fov' in camera ? camera.fov : null,
    }), () => ({
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      toneMapping: gl.toneMapping,
      programs: gl.info.programs?.length ?? 0,
    }));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI;
    camera.rotation.x = 0;
    gl.toneMapping = AgXToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.domElement.style.touchAction = 'none';
    gl.domElement.style.outline = 'none';
    useSession.getState().setProgress(0.36);
  }, [camera, gl]);

  return null;
}

export function CanvasRoot() {
  const tier = useAppliedQuality((state) => state.tier);
  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="always"
        dpr={qualityProfiles[tier].dpr}
        shadows={false}
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: 62,
          near: 0.08,
          far: 500,
          position: [0, 1.62, -8.2],
        }}
        onCreated={({ camera }) => {
          camera.rotation.order = 'YXZ';
          camera.rotation.y = Math.PI;
          camera.position.set(0, 1.62, -8.2);
        }}
      >
        <CanvasLifecycle />
        <CrosshairRig />
        <WindowRig />
        <ExposureDirector />
        <SceneManager />
        <AudioRig />
        <QualityDirector />
        <ContextGuard />
        <PerfProbe />
      </Canvas>
    </div>
  );
}
