'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { audioEngine } from '@/engine/audio/engine';
import { playerRef } from '@/engine/player/playerRef';

const forward = new Vector3();

export function AudioRig() {
  const camera = useThree((state) => state.camera);
  const wait = useRef(0);

  useFrame((_, dt) => {
    camera.getWorldDirection(forward);
    audioEngine.setListener(camera.position, forward);
    wait.current += dt;
    if (wait.current < 0.1) return;
    wait.current = 0;
    const position = playerRef.current.position;
    audioEngine.setPlayer(position.x, position.y, position.z);
  });

  return null;
}
