import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '@/engine/input/InputManager';
import { useInputStore } from '@/state/input';

type Listener = (event: Event) => void;

function installDom() {
  const windowListeners = new Map<string, Set<Listener>>();
  const docListeners = new Map<string, Set<Listener>>();
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
  const canvas = {
    addEventListener: listen(new Map()),
    removeEventListener: forget(new Map()),
    requestPointerLock: vi.fn(() => undefined),
  };
  const documentStub = {
    pointerLockElement: null as unknown,
    hidden: false,
    activeElement: null as { tagName?: string; blur?: () => void } | null,
    hasFocus: () => focused,
    addEventListener: listen(docListeners),
    removeEventListener: forget(docListeners),
    exitPointerLock() {
      /* The browser keeps the lock until pointerlockchange. */
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
  };
}

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
