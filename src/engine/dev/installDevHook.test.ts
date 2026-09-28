import { afterEach, describe, expect, it, vi } from 'vitest';
import { devHooksEnabled, installDevHook } from '@/engine/dev/installDevHook';
import { takePlayerTransform } from '@/engine/player/playerCommand';

describe('test hooks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    takePlayerTransform();
  });

  it('stays off in production unless the QA build flag is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_GHILAND_TEST_HOOKS', '');
    expect(devHooksEnabled()).toBe(false);
    vi.stubGlobal('window', {});
    installDevHook(() => 1);
    expect(window.__ghiland).toBeUndefined();

    vi.stubEnv('NEXT_PUBLIC_GHILAND_TEST_HOOKS', '1');
    installDevHook(() => 4);
    expect(window.__ghiland?.getCanvasMounts()).toBe(4);
    window.__ghiland?.setPlayer({
      position: { x: 0.7, y: 1.62, z: -3 },
      yaw: -0.2,
      pitch: 0.1,
    });
    expect(takePlayerTransform()).toEqual({ x: 0.7, y: 1.62, z: -3, yaw: -0.2, pitch: 0.1 });
    expect(takePlayerTransform()).toBeNull();
  });
});
