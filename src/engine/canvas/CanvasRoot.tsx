'use client';

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { installDevHook } from '@/engine/dev/installDevHook';
import { PerfProbe } from '@/engine/perf/PerfProbe';
import { FirstPersonController } from '@/engine/player/FirstPersonController';
import { SeasideHouseScene } from '@/worlds/seaside-house/Scene';
import { seasideColliders, SPAWN } from '@/worlds/seaside-house/level';

let canvasMounts = 0;

function CanvasLifecycle() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    canvasMounts += 1;
    installDevHook(() => canvasMounts);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI;
    camera.rotation.x = 0;
    camera.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.domElement.style.touchAction = 'none';
    gl.domElement.style.outline = 'none';
  }, [camera, gl]);

  return null;
}

export function CanvasRoot() {
  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="always"
        dpr={[1, 1.5]}
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
          position: [SPAWN.x, SPAWN.y, SPAWN.z],
        }}
        onCreated={({ camera }) => {
          camera.rotation.order = 'YXZ';
          camera.rotation.y = Math.PI;
          camera.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
        }}
      >
        <CanvasLifecycle />
        <SeasideHouseScene />
        <FirstPersonController spawn={SPAWN} colliders={seasideColliders} />
        <PerfProbe />
      </Canvas>
    </div>
  );
}
