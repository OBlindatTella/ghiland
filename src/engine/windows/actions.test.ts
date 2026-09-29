import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { autoPinCarried } from '@/engine/windows/actions';
import { seedCarry } from '@/engine/windows/carryPose';
import { bindCrosshairCamera } from '@/engine/windows/crosshair';
import { InputManager } from '@/engine/input/InputManager';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';
import { useWindows } from '@/state/windows';

const detached = {
  id: 'notes-1',
  appId: 'notes',
  title: 'Notes',
  mode: { kind: 'detached' as const, offset: [0, 0, -1.1] as [number, number, number], lagMs: 150 },
  lastScreenRect: { x: 40, y: 48, w: 440, h: 560 },
  state: 'normal' as const,
  z: 1,
  owner: 'local' as const,
  createdAt: 1,
};

describe('auto-pin on lock loss', () => {
  afterEach(() => {
    bindCrosshairCamera(null);
    useWindows.setState({ windows: {}, focusedId: null });
    useInputStore.getState().reset();
    useSession.setState({ worldId: null, worldPhase: 'idle', phase: 'landing' });
    vi.unstubAllGlobals();
  });

  it('pins the carried window as a float before the shell leaves WORLD', () => {
    const camera = new PerspectiveCamera(62, 1, 0.1, 50);
    camera.position.set(1, 1.62, 0);
    camera.lookAt(1, 1.62, 4);
    camera.updateMatrixWorld();
    bindCrosshairCamera(camera);
    useSession.setState({ worldId: 'seaside-house', worldPhase: 'active', phase: 'inWorld' });
    useWindows.setState({ windows: { 'notes-1': detached }, focusedId: 'notes-1' });
    seedCarry('notes-1', [1, 1.5, 1.1], [0, 0, 0, 1]);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });

    const exits = { count: 0 };
    vi.stubGlobal('document', {
      pointerLockElement: {},
      hidden: false,
      hasFocus: () => true,
      exitPointerLock: () => {
        exits.count += 1;
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    vi.stubGlobal('window', {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setTimeout: (fn: () => void) => {
        fn();
        return 1;
      },
      clearTimeout: () => undefined,
    });

    const manager = new InputManager();
    useInputStore.setState({ shellState: 'WORLD', owner: 'world', showClickToWalk: false, pointerLocked: true });
    manager.setBeforeShellChange(() => autoPinCarried());
    manager.loseContext();

    const mode = useWindows.getState().windows['notes-1']?.mode;
    expect(mode?.kind).toBe('worldPinned');
    if (mode?.kind === 'worldPinned') {
      expect(mode.placement).toBe('float');
      expect(mode.position[2]).toBeGreaterThan(0.5);
    }
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    expect(useInputStore.getState().pointerLocked).toBe(false);
    expect(exits.count).toBeGreaterThan(0);
    manager.setBeforeShellChange(null);
  });
});
