import { afterEach, describe, expect, it, vi } from 'vitest';
import { devHooksEnabled, installDevHook } from '@/engine/dev/installDevHook';
import { exposureSample } from '@/engine/environment/exposureSample';
import { readFps, setFakeFps } from '@/engine/quality/fakeFps';
import { takePlayerTransform } from '@/engine/player/playerCommand';
import { readCarryFrames, setCarryTrace } from '@/engine/windows/carryPose';
import { readWindowsFile } from '@/shell/windows/persistence';
import { useSession } from '@/state/session';
import { useWindows } from '@/state/windows';

describe('test hooks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    takePlayerTransform();
    setCarryTrace(false);
    setFakeFps(null);
    useSession.setState({ phase: 'landing', worldId: null, worldPhase: 'idle', loadProgress: 0 });
    useWindows.setState({ windows: {}, focusedId: null });
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

    window.__ghiland?.setFakeFps(22);
    expect(readFps(4)).toEqual({ fps: 22, injected: true });
    window.__ghiland?.setFakeFps(null);
    expect(readFps(4)).toEqual({ fps: 4, injected: false });

    exposureSample.exposure = 0.91;
    exposureSample.zone = 'terrace';
    expect(window.__ghiland?.getExposure()).toEqual({ exposure: 0.91, zone: 'terrace' });

    useSession.setState({ worldId: 'seaside-house' });
    const rays = window.__ghiland?.getRaySets();
    expect(rays?.placement.some((item) => item.id === 'living-floor')).toBe(true);
    expect(rays?.occlusion.some((item) => item.id === 'living-floor')).toBe(false);
    expect(rays?.crosshair.length).toBe(rays?.occlusion.length);

    useWindows.setState({
      windows: {
        'win-1': {
          id: 'win-1',
          appId: 'notes',
          title: 'Notes',
          mode: { kind: 'worldPinned', worldId: 'seaside-house', position: [1, 1, 1], quaternion: [0, 0, 0, 1], pxPerMeter: 520, placement: 'anchor', anchorId: 'hero-sea' },
          lastScreenRect: { x: 0, y: 0, w: 440, h: 560 },
          state: 'minimized',
          z: 1,
          owner: 'local',
          createdAt: 0,
        },
      },
      focusedId: 'win-1',
    });
    vi.stubGlobal('document', { querySelector: (selector: string) => (selector.includes('data-pin-tag') ? {} : null) });
    const listed = window.__ghiland?.getWindows();
    expect(listed).toEqual([
      {
        id: 'win-1',
        appId: 'notes',
        state: 'minimized',
        mode: 'worldPinned',
        anchorId: 'hero-sea',
        minimized: true,
        pinTag: true,
      },
    ]);

    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
    window.__ghiland?.injectMalformedPin();
    expect(readWindowsFile().pinned).toEqual([]);
    expect([...memory.keys()].some((key) => key.startsWith('ghiland:windows:quarantine-'))).toBe(true);

    let writes = 0;
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      writes += 1;
      original(key, value);
    };
    window.__ghiland?.armQuotaError();
    expect(() => localStorage.setItem('ghiland:settings', '{}')).toThrow(DOMException);
    localStorage.setItem('ghiland:settings', '{"ok":true}');
    expect(writes).toBe(1);
    expect(memory.get('ghiland:settings')).toBe('{"ok":true}');

    expect(readCarryFrames()).toEqual([]);
    useSession.setState({ phase: 'landing', worldId: null, worldPhase: 'idle', loadProgress: 0 });
    useWindows.setState({ windows: {}, focusedId: null });
  });
});
