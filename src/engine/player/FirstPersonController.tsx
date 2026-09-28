'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Collider } from '@/contracts/world';
import { inputManager } from '@/engine/input/InputManager';
import { slideMove, type Body } from '@/engine/player/collision';
import {
  clampFrameDt,
  clampLookDelta,
  clampPitch,
  dampVec2,
  DEFAULT_MOVEMENT,
  viewToWorld,
  wishVelocity,
  yawFromMouse,
} from '@/engine/player/movement';
import { playerRef } from '@/engine/player/playerRef';
import { useInputStore } from '@/state/input';
import { useSettings } from '@/state/settings';

const BODY: Body = {
  radius: DEFAULT_MOVEMENT.capsule.radius,
  feetY: 0,
  height: DEFAULT_MOVEMENT.capsule.height,
};
const LOOK_SENSITIVITY = 0.0022;
const LOOK_TAU = 0.04;

export function FirstPersonController({
  spawn,
  colliders,
}: {
  spawn: { x: number; y: number; z: number };
  colliders: readonly Collider[];
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const pos = useRef({ x: spawn.x, z: spawn.z });
  const vel = useRef({ x: 0, z: 0 });
  const lookAvgX = useRef(0);
  const lookAvgY = useRef(0);

  useEffect(() => inputManager.attach(gl.domElement), [gl]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const scaledX = clampLookDelta(event.movementX, lookAvgX.current);
      const scaledY = clampLookDelta(event.movementY, lookAvgY.current);
      lookAvgX.current = scaledX.average;
      lookAvgY.current = scaledY.average;
      const sensitivity = useSettings.getState().mouseSensitivity;
      const invert = useSettings.getState().invertY ? -1 : 1;
      targetYaw.current += yawFromMouse(scaledX.delta, LOOK_SENSITIVITY * sensitivity);
      targetPitch.current = clampPitch(
        targetPitch.current - scaledY.delta * LOOK_SENSITIVITY * sensitivity * invert,
      );
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [gl]);

  useFrame((_, dt) => {
    const step = clampFrameDt(dt);
    const lookAlpha = 1 - Math.exp(-step / LOOK_TAU);
    yaw.current += (targetYaw.current - yaw.current) * lookAlpha;
    pitch.current += (targetPitch.current - pitch.current) * lookAlpha;

    const shell = useInputStore.getState().shellState;
    const locked = useInputStore.getState().pointerLocked;
    if (shell !== 'WORLD' || !locked) {
      vel.current = { x: 0, z: 0 };
    } else if (step > 0) {
      const wish = viewToWorld(
        wishVelocity({
          forward: inputManager.isActionDown('moveForward'),
          back: inputManager.isActionDown('moveBack'),
          left: inputManager.isActionDown('moveLeft'),
          right: inputManager.isActionDown('moveRight'),
          strollFast: inputManager.isActionDown('strollFast'),
        }),
        yaw.current,
      );
      vel.current = dampVec2(vel.current, wish, step);
      const moved = slideMove(
        pos.current.x,
        pos.current.z,
        vel.current.x * step,
        vel.current.z * step,
        BODY,
        colliders,
      );
      pos.current = moved;
    }

    const eye = spawn.y;
    camera.position.set(pos.current.x, eye, pos.current.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI + yaw.current;
    camera.rotation.x = pitch.current;
    camera.rotation.z = 0;
    playerRef.current = {
      position: { x: pos.current.x, y: eye, z: pos.current.z },
      yaw: yaw.current,
      pitch: pitch.current,
    };
  });

  return null;
}
