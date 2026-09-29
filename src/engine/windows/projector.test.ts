import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { projectWindow } from '@/engine/windows/projector';

describe('window projector', () => {
  it('projects a window in front of the camera and culls one behind it', () => {
    const camera = new PerspectiveCamera(62, 16 / 9, 0.08, 100);
    camera.position.set(0, 1.62, 0);
    camera.lookAt(0, 1.62, 5);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const ahead = projectWindow(camera, [0, 1.62, 2], [0, 0, 0, 1]);
    expect(ahead.behind).toBe(false);
    expect(ahead.object).toContain('matrix3d(');
    expect(ahead.object).toContain('translate(-50%,-50%)');
    const behind = projectWindow(camera, [0, 1.62, -2], [0, 0, 0, 1]);
    expect(behind.behind).toBe(true);
    expect(behind.object).toBeNull();
  });
});
