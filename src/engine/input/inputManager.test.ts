import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '@/engine/input/InputManager';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';

type Listener = (event: Event) => void;

function installDom() {
  useSession.setState({ phase: 'inWorld', worldPhase: 'active' });
  const windowListeners = new Map<string, Set<Listener>>();
  const docListeners = new Map<string, Set<Listener>>();
  const canvasListeners = new Map<string, Set<Listener>>();
  const listen = (map: Map<string, Set<Listener>>) => (type: string, fn: EventListener) => {
    let set = map.get(type);
    if (!set) {
      set = new Set();
      map.set(type, set);
    }
    set.add(fn as Listener);
  };
  const forget = (map: Map<string, Set<Listener>>) => (type: string, fn: EventListener) => {
    map.get(type)?.delete(fn as Listener);
  };
  let focused = true;
  let exits = 0;
  const requestPointerLock = vi.fn((_options?: { unadjustedMovement?: boolean }): Promise<void> | undefined => undefined);
  const canvas = {
    addEventListener: listen(canvasListeners),
    removeEventListener: forget(canvasListeners),
    requestPointerLock,
  };
  const documentStub = {
    pointerLockElement: null as unknown,
    hidden: false,
    activeElement: null as { tagName?: string; blur?: () => void } | null,
    hasFocus: () => focused,
    addEventListener: listen(docListeners),
    removeEventListener: forget(docListeners),
    exitPointerLock() {
      exits += 1;
    },
  };
  const windowStub = {
    addEventListener: listen(windowListeners),
    removeEventListener: forget(windowListeners),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
  vi.stubGlobal('window', windowStub);
  vi.stubGlobal('document', documentStub);
  const fire = (map: Map<string, Set<Listener>>, type: string, event: object) => {
    for (const fn of [...(map.get(type) ?? [])]) fn(event as Event);
  };
  return {
    canvas: canvas as unknown as HTMLElement,
    documentStub,
    setFocused(value: boolean) {
      focused = value;
    },
    fireWindow(type: string, event: object) {
      fire(windowListeners, type, event);
    },
    fireDoc(type: string, event: object) {
      fire(docListeners, type, event);
    },
    exits: () => exits,
    requestPointerLock,
    fireCanvas(type: string, event: object) {
      fire(canvasListeners, type, event);
    },
  };
}

describe('arrival gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useInputStore.getState().reset();
    useSession.setState({ phase: 'landing', worldId: null, worldPhase: 'idle', loadProgress: 0 });
  });

  it('ignores keys and the pointer until the world is active', () => {
    const dom = installDom();
    useSession.setState({ worldPhase: 'loading', phase: 'loading' });
    const manager = new InputManager();
    manager.attach(dom.canvas);
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    dom.fireCanvas('pointerdown', { clientX: 4, clientY: 4, target: {} });
    dom.fireCanvas('click', { clientX: 4, clientY: 4, target: {} });
    expect(dom.requestPointerLock).not.toHaveBeenCalled();

    useSession.setState({ worldPhase: 'active' });
    dom.fireCanvas('pointerdown', { clientX: 4, clientY: 4, target: {} });
    dom.fireCanvas('click', { clientX: 4, clientY: 4, target: {} });
    expect(dom.requestPointerLock).toHaveBeenCalledTimes(1);
    manager.detach();
  });
});

describe('iframe focus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useInputStore.getState().reset();
  });

  it('does not treat focus moving into an iframe as a shell blur', async () => {
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'WORLD', owner: 'world', showClickToWalk: false });
    manager.attach(dom.canvas);

    dom.documentStub.activeElement = { tagName: 'IFRAME' };
    dom.setFocused(true);
    dom.fireWindow('blur', {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useInputStore.getState().shellState).toBe('WORLD');

    dom.documentStub.activeElement = null;
    dom.setFocused(false);
    dom.fireWindow('blur', {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    manager.detach();
  });
});

describe('pointer lock without a promise', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useInputStore.getState().reset();
  });

  it('counts pointerlockerror when requestPointerLock returns undefined', () => {
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'SCREEN', owner: 'ui', showClickToWalk: false, relockBlocked: false });
    manager.attach(dom.canvas);
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    dom.fireDoc('pointerlockerror', {});
    expect(useInputStore.getState().showClickToWalk).toBe(true);
    expect(useInputStore.getState().relockBlocked).toBe(true);
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    manager.detach();
  });

  it('keeps the fallback lock when the unadjustedMovement request is rejected', async () => {
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'SCREEN', owner: 'ui', showClickToWalk: false, relockBlocked: false });
    let calls = 0;
    dom.requestPointerLock.mockImplementation((options?: { unadjustedMovement?: boolean }) => {
      calls += 1;
      if (options?.unadjustedMovement) {
        dom.fireDoc('pointerlockerror', {});
        return Promise.reject(new DOMException('unsupported', 'NotSupportedError'));
      }
      return Promise.resolve();
    });
    manager.attach(dom.canvas);
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    await Promise.resolve();
    expect(calls).toBe(2);
    expect(useInputStore.getState().relockBlocked).toBe(false);
    dom.documentStub.pointerLockElement = dom.canvas;
    dom.fireDoc('pointerlockchange', {});
    expect(useInputStore.getState().shellState).toBe('WORLD');
    expect(useInputStore.getState().pointerLocked).toBe(true);
    expect(dom.exits()).toBe(0);
    manager.detach();
  });
});

describe('escape pairing', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useInputStore.getState().reset();
  });

  it('still swallows the unlocking Esc after a 500 ms hitch', () => {
    vi.useFakeTimers();
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'WORLD', owner: 'world', showClickToWalk: false });
    dom.documentStub.pointerLockElement = dom.canvas;
    manager.attach(dom.canvas);
    dom.documentStub.pointerLockElement = null;
    dom.fireDoc('pointerlockchange', {});
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    vi.advanceTimersByTime(500);
    dom.fireWindow('keydown', { code: 'Escape', repeat: false, preventDefault() {} });
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    dom.fireWindow('keydown', { code: 'Escape', repeat: false, preventDefault() {} });
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    manager.detach();
  });

  it('ends on RELEASED when Esc follows Q before the unlock lands', () => {
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'WORLD', owner: 'world', showClickToWalk: false });
    dom.documentStub.pointerLockElement = dom.canvas;
    manager.attach(dom.canvas);
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    dom.fireWindow('keydown', { code: 'Escape', repeat: false, preventDefault() {} });
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    dom.documentStub.pointerLockElement = null;
    dom.fireDoc('pointerlockchange', {});
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    manager.detach();
  });
});

describe('pending pointer lock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useInputStore.getState().reset();
  });

  it('cancels a lock requested by Q when Esc arrives first', () => {
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'SCREEN', owner: 'ui', showClickToWalk: false });
    manager.attach(dom.canvas);
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    dom.fireWindow('keydown', { code: 'Escape', repeat: false, preventDefault() {} });
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    dom.documentStub.pointerLockElement = dom.canvas;
    dom.fireDoc('pointerlockchange', {});
    expect(dom.exits()).toBeGreaterThan(0);
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    expect(useInputStore.getState().pointerLocked).toBe(false);
    manager.detach();
  });

  it('does not treat a second Q as a lock while the first exit is in flight', () => {
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'WORLD', owner: 'world', showClickToWalk: false });
    dom.documentStub.pointerLockElement = dom.canvas;
    manager.attach(dom.canvas);
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    dom.documentStub.pointerLockElement = null;
    dom.fireDoc('pointerlockchange', {});
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    dom.documentStub.pointerLockElement = dom.canvas;
    dom.fireDoc('pointerlockchange', {});
    expect(useInputStore.getState().shellState).toBe('WORLD');
    manager.detach();
  });
});

describe('shell prep for windows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useInputStore.getState().reset();
  });

  it('runs the pre-transition hook before the store updates', () => {
    const dom = installDom();
    const manager = new InputManager();
    manager.attach(dom.canvas);
    const during: string[] = [];
    manager.setBeforeShellChange((from, to) => {
      during.push(`${from}:${useInputStore.getState().shellState}:${to}`);
    });
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    expect(during).toEqual(['RELEASED:RELEASED:SCREEN']);
    expect(useInputStore.getState().shellState).toBe('SCREEN');
    manager.setBeforeShellChange(null);
    manager.detach();
  });

  it('routes context loss through apply, releases the pointer, and drops a pending lock', () => {
    const dom = installDom();
    const manager = new InputManager();
    useInputStore.setState({ shellState: 'WORLD', owner: 'world', showClickToWalk: false, pointerLocked: true });
    dom.documentStub.pointerLockElement = dom.canvas;
    manager.attach(dom.canvas);
    const during: string[] = [];
    manager.setBeforeShellChange((from, to) => {
      during.push(`${from}:${useInputStore.getState().shellState}:${to}`);
    });
    manager.loseContext();
    expect(during).toEqual(['WORLD:WORLD:RELEASED']);
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    expect(dom.exits()).toBeGreaterThan(0);
    dom.documentStub.pointerLockElement = null;
    dom.fireDoc('pointerlockchange', {});
    expect(useInputStore.getState().shellState).toBe('RELEASED');

    useInputStore.setState({ shellState: 'SCREEN', owner: 'ui', showClickToWalk: false, relockBlocked: false });
    dom.fireWindow('keydown', { code: 'KeyQ', repeat: false, preventDefault() {} });
    manager.loseContext();
    dom.documentStub.pointerLockElement = dom.canvas;
    dom.fireDoc('pointerlockchange', {});
    expect(dom.exits()).toBeGreaterThan(1);
    expect(useInputStore.getState().shellState).toBe('RELEASED');
    manager.setBeforeShellChange(null);
    manager.detach();
  });

  it('takes an empty-world click from the canvas and ignores a window root', () => {
    const dom = installDom();
    const manager = new InputManager();
    manager.attach(dom.canvas);
    const windowRoot = { closest: (selector: string) => (selector === '[data-ghiland-window]' ? {} : null) };
    dom.fireCanvas('pointerdown', { clientX: 1, clientY: 1, target: windowRoot });
    dom.fireCanvas('click', { clientX: 1, clientY: 1, target: windowRoot });
    expect(dom.requestPointerLock).not.toHaveBeenCalled();

    dom.fireCanvas('pointerdown', { clientX: 0, clientY: 0, target: {} });
    dom.fireCanvas('click', { clientX: 20, clientY: 0, target: {} });
    expect(dom.requestPointerLock).not.toHaveBeenCalled();

    dom.fireCanvas('pointerdown', { clientX: 8, clientY: 8, target: {} });
    dom.fireCanvas('click', { clientX: 9, clientY: 8, target: {} });
    expect(dom.requestPointerLock).toHaveBeenCalledTimes(1);
    manager.detach();
  });
});
