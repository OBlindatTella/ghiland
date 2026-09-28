'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Collider } from '@/contracts/world';
import { inputManager } from '@/engine/input/InputManager';
import { slideMove, type Body } from '@/engine/player/collision';
import {
  clampFrameDt,
  clampLookVector,
  clampPitch,
  LOOK_GUARD_MS,
  dampVec2,
  DEFAULT_MOVEMENT,
  resolveEyeHeight,
  viewToWorld,
  wishVelocity,
  yawFromMouse,
} from '@/engine/player/movement';
import { takePlayerTransform } from '@/engine/player/playerCommand';
import { playerRef } from '@/engine/player/playerRef';
import { CAMERA_FRAME_PRIORITY } from '@/engine/render/frameOrder';
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
  eyeHeight = resolveEyeHeight(),
}: {
  spawn: { x: number; y: number; z: number };
  colliders: readonly Collider[];
  eyeHeight?: number;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const pos = useRef({ x: spawn.x, z: spawn.z });
  const vel = useRef({ x: 0, z: 0 });
  const lookAvg = useRef(0);
  const lookGuardUntil = useRef(0);
  const eye = useRef(eyeHeight);

  useEffect(() => inputManager.attach(gl.domElement), [gl]);

  useEffect(() => {
    eye.current = eyeHeight;
  }, [eyeHeight]);

  useEffect(() => {
    const onLock = () => {
      if (document.pointerLockElement !== gl.domElement) return;
      lookAvg.current = 0;
      lookGuardUntil.current = performance.now() + LOOK_GUARD_MS;
    };
    const onMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const scaled = clampLookVector(
        event.movementX,
        event.movementY,
        lookAvg.current,
        performance.now() < lookGuardUntil.current,
      );
      lookAvg.current = scaled.average;
      const sensitivity = useSettings.getState().mouseSensitivity;
      const invert = useSettings.getState().invertY ? -1 : 1;
      targetYaw.current += yawFromMouse(scaled.dx, LOOK_SENSITIVITY * sensitivity);
      targetPitch.current = clampPitch(
        targetPitch.current - scaled.dy * LOOK_SENSITIVITY * sensitivity * invert,
      );
    };
    document.addEventListener('pointerlockchange', onLock);
    window.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      window.removeEventListener('mousemove', onMove);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const command = takePlayerTransform();
    if (command) {
      pos.current = { x: command.x, z: command.z };
      eye.current = command.y;
      yaw.current = command.yaw;
      targetYaw.current = command.yaw;
      pitch.current = command.pitch;
      targetPitch.current = command.pitch;
      vel.current = { x: 0, z: 0 };
    }
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

    camera.position.set(pos.current.x, eye.current, pos.current.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI + yaw.current;
    camera.rotation.x = pitch.current;
    camera.rotation.z = 0;
    playerRef.current = {
      position: { x: pos.current.x, y: eye.current, z: pos.current.z },
      yaw: yaw.current,
      pitch: pitch.current,
    };
  }, CAMERA_FRAME_PRIORITY);

  return null;
}
