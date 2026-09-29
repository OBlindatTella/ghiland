import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import type { AABB } from '@/contracts/math';
import { raycastCrosshair, type WindowQuad } from '@/engine/windows/crosshair';
import { seasideColliders } from '@/worlds/seaside-house/level';

function lookingForward(): PerspectiveCamera {
  const camera = new PerspectiveCamera(62, 1, 0.08, 100);
  camera.position.set(0, 1.62, 0);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = Math.PI;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

const centre: WindowQuad = {
  id: 'notes',
  position: [0, 1.62, 2],
  // Front (local +Z) turned toward the camera on the −Z side.
  quaternion: [0, 1, 0, 0],
  half: { w: 0.4, h: 0.5 },
};

describe('crosshair raycast', () => {
  it('returns null when nothing is registered', () => {
    expect(raycastCrosshair(lookingForward(), [])).toBeNull();
  });

  it('hits the quad under the crosshair and misses one off to the side', () => {
    const camera = lookingForward();
    expect(raycastCrosshair(camera, [centre])).toBe('notes');
    const aside: WindowQuad = { ...centre, id: 'aside', position: [3, 1.62, 2], half: { w: 0.2, h: 0.2 } };
    expect(raycastCrosshair(camera, [aside])).toBeNull();
    expect(raycastCrosshair(camera, [aside, centre])).toBe('notes');
    const back: WindowQuad = { ...centre, id: 'back', quaternion: [0, 0, 0, 1] };
    expect(raycastCrosshair(camera, [back])).toBeNull();
    const tag: WindowQuad = {
      ...back,
      id: 'tag',
      half: { w: 0.04, h: 0.04 },
      quaternion: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w],
    };
    expect(raycastCrosshair(camera, [tag])).toBe('tag');
  });

  it('stops at a wall, ignores a window past 25 m, and keeps glass from blocking', () => {
    const camera = lookingForward();
    const wall: AABB = { min: [-2, 0, 1], max: [2, 3, 1.2] };
    expect(raycastCrosshair(camera, [centre], [wall])).toBeNull();
    const beyond: WindowQuad = { ...centre, id: 'far', position: [0, 1.62, 40] };
    expect(raycastCrosshair(camera, [beyond], [])).toBeNull();
    expect(raycastCrosshair(camera, [centre], [])).toBe('notes');
  });

  it('puts floors, ceilings, and the terrace on the placement layer only', () => {
    for (const id of ['corridor-floor', 'corridor-ceiling', 'living-floor', 'living-ceiling', 'terrace-floor']) {
      const collider = seasideColliders.find((item) => item.id === id);
      expect(collider?.layers).toEqual(['placement']);
    }
    const glass = seasideColliders.find((item) => item.id === 'glass-closed-east');
    expect(glass?.layers).toEqual(['movement']);
  });
});
