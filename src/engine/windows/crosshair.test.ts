import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { raycastCrosshair, type WindowQuad } from '@/engine/windows/crosshair';

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
  quaternion: [0, 0, 0, 1],
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
  });
});
