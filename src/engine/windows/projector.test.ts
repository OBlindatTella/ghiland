import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { cameraStageTransform, projectWindow } from '@/engine/windows/projector';

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
    expect(ahead.object).toContain(',1040,');
    const behind = projectWindow(camera, [0, 1.62, -2], [0, 0, 0, 1]);
    expect(behind.behind).toBe(true);
    expect(behind.object).toBeNull();
  });

  it('hides a window when a corner crosses the camera near plane', () => {
    const camera = new PerspectiveCamera(62, 16 / 9, 0.08, 100);
    camera.position.set(0, 1.62, 0);
    camera.lookAt(0, 1.62, 5);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const yaw = Math.PI / 2;
    const quaternion = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] as [number, number, number, number];
    const straddling = projectWindow(camera, [0, 1.62, 0.4], quaternion, { w: 1.2, h: 0.3 });
    expect(straddling.behind).toBe(true);
    expect(straddling.object).toBeNull();
    const clear = projectWindow(camera, [0, 1.62, 3], [0, 0, 0, 1], { w: 0.4, h: 0.3 });
    expect(clear.behind).toBe(false);
  });

  it('keeps the viewport centre in screen pixels, after perspective', () => {
    const camera = new PerspectiveCamera(62, 16 / 9, 0.08, 100);
    camera.position.set(0, 1.62, -8.2);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const stage = cameraStageTransform(camera, 1280, 720);
    expect(stage.startsWith('translate(640px,360px)perspective(')).toBe(true);
    expect(stage).toContain(',-4264,');
  });
});
