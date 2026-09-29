'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { dampExposure, exposureTarget, zoneAt } from '@/engine/environment/exposure';
import { playerRef } from '@/engine/player/playerRef';
import { getWorld } from '@/worlds/registry';
import { useSession } from '@/state/session';

const forward = new Vector3();

/** Shifts renderer exposure from the corridor (about 1.2) toward 0.9 as the glass fills the view. */
export function ExposureDirector() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const exposure = useRef(1.2);

  useFrame((_, dt) => {
    const worldId = useSession.getState().worldId;
    const world = worldId ? getWorld(worldId) : undefined;
    const zone = world ? zoneAt(playerRef.current.position, world.zones) : 'interior';
    camera.getWorldDirection(forward);
    const target = exposureTarget(zone, forward.z);
    exposure.current = dampExposure(exposure.current, target, dt);
    gl.toneMappingExposure = exposure.current;
  });

  return null;
}
