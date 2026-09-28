import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCameraPath } from '@/engine/dev/cameraPath';
import { takePlayerTransform } from '@/engine/player/playerCommand';

describe('camera path', () => {
  afterEach(() => {
    vi.useRealTimers();
    takePlayerTransform();
  });

  it('queues each stop in order and can be cancelled', () => {
    vi.useFakeTimers();
    const cancel = runCameraPath([
      { x: 0, y: 1.62, z: -3, yaw: 0, holdMs: 100 },
      { x: 0, y: 1.62, z: 8.6, yaw: 0, holdMs: 100 },
      { x: 1, y: 1.62, z: 8.6, yaw: 0 },
    ]);
    expect(takePlayerTransform()).toMatchObject({ x: 0, z: -3, yaw: 0 });
    vi.advanceTimersByTime(100);
    expect(takePlayerTransform()).toMatchObject({ z: 8.6 });
    cancel();
    vi.advanceTimersByTime(100);
    expect(takePlayerTransform()).toBeNull();
  });
});
