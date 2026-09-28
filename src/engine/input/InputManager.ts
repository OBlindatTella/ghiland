import type { Action } from '@/contracts/input';
import { bus } from '@/engine/events/bus';
import { defaultBindings } from '@/engine/input/bindings';
import { KeyState } from '@/engine/input/keyState';
import { ownerForShell, OwnerStack } from '@/engine/input/ownerStack';
import { requestCanvasPointerLock } from '@/engine/input/pointerLock';
import { idleEscapeGate, onBrowserEscapeUnlock, onEscapeKey, type EscapeGate } from '@/engine/input/escapeGate';
import { classifyLockLoss, reduceShell, type ShellEffect, type ShellModel } from '@/engine/input/shellMachine';
import { useInputStore } from '@/state/input';
import { usePerfStore } from '@/state/perf';

export class InputManager {
  private keys = new KeyState();
  private owners = new OwnerStack('ui');
  private canvas: HTMLElement | null = null;
  private pendingLock = false;
  private unlockIntent: 'toggle' | null = null;
  private lockGeneration = 0;
  private escapeGate: EscapeGate = idleEscapeGate;
  private escapeReset = 0;

  attach(canvas: HTMLElement): () => void {
    this.detach();
    this.canvas = canvas;
    this.owners.setBase(ownerForShell(useInputStore.getState().shellState));
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    return () => this.detach();
  }

  detach(): void {
    if (!this.canvas) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    this.canvas = null;
    this.pendingLock = false;
  }

  isActionDown(action: Action): boolean {
    const binding = defaultBindings.find((item) => item.action === action);
    if (!binding || !binding.owners.includes(this.owners.current())) return false;
    return binding.codes.some((code) => this.keys.isDown(code));
  }

  clickEmptyWorld(): void {
    this.apply(reduceShell(this.readModel(), { type: 'clickEmptyWorld' }));
  }

  private readModel(): ShellModel {
    const state = useInputStore.getState();
    return {
      state: state.shellState,
      relockBlocked: state.relockBlocked,
      showClickToWalk: state.showClickToWalk,
    };
  }

  private apply(result: { model: ShellModel; effects: ShellEffect[] }): void {
    const previous = useInputStore.getState().shellState;
    this.owners.setBase(ownerForShell(result.model.state));
    useInputStore.getState().applyModel(result.model, this.owners.current());
    if (previous !== result.model.state) {
      bus.emit('shell:stateChanged', { from: previous, to: result.model.state });
      if (result.model.state === 'WORLD') this.keys.suppressHeld();
    }
    for (const effect of result.effects) {
      if (effect.type === 'exitPointerLock') {
        if (effect.intent === 'toggle') this.unlockIntent = 'toggle';
        if (document.pointerLockElement) document.exitPointerLock();
      } else {
        this.requestLock();
      }
    }
  }

  private requestLock(): void {
    const canvas = this.canvas;
    if (!canvas || this.pendingLock) return;
    if (document.pointerLockElement === canvas) {
      this.apply(reduceShell(this.readModel(), { type: 'pointerLockGained' }));
      useInputStore.getState().setPointerLocked(true);
      return;
    }
    this.pendingLock = true;
    const generation = this.lockGeneration + 1;
    this.lockGeneration = generation;
    const fail = () => {
      if (generation !== this.lockGeneration || !this.pendingLock) return;
      this.pendingLock = false;
      this.lockGeneration += 1;
      this.apply(reduceShell(this.readModel(), { type: 'pointerLockRejected' }));
    };
    void requestCanvasPointerLock(canvas).then(
      () => {
        if (generation !== this.lockGeneration) return;
        this.pendingLock = false;
      },
      () => fail(),
    );
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.keyDown(event.code);
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'KeyQ') {
      this.apply(reduceShell(this.readModel(), { type: 'toggleScreen' }));
    } else if (event.code === 'Escape') {
      const next = onEscapeKey(this.escapeGate, document.pointerLockElement !== null);
      this.escapeGate = next.gate;
      this.scheduleEscapeReset();
      if (next.apply) this.apply(reduceShell(this.readModel(), { type: 'escape' }));
    } else if (event.code === 'Backquote') {
      usePerfStore.getState().toggle();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.keyUp(event.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.unlockIntent = null;
    this.apply(reduceShell(this.readModel(), { type: 'blur' }));
  };

  private onVisibility = (): void => {
    if (!document.hidden) return;
    this.keys.clear();
    this.unlockIntent = null;
    this.apply(reduceShell(this.readModel(), { type: 'tabHidden' }));
  };

  private onLockChange = (): void => {
    const locked = this.canvas !== null && document.pointerLockElement === this.canvas;
    this.pendingLock = false;
    if (locked) {
      this.unlockIntent = null;
      this.apply(reduceShell(this.readModel(), { type: 'pointerLockGained' }));
      useInputStore.getState().setPointerLocked(true);
      return;
    }
    const reason = classifyLockLoss({
      requestedToggle: this.unlockIntent === 'toggle',
      hidden: document.hidden,
      focused: document.hasFocus(),
    });
    this.unlockIntent = null;
    if (reason === 'escape') {
      this.escapeGate = onBrowserEscapeUnlock(this.escapeGate);
      this.scheduleEscapeReset();
    }
    this.apply(reduceShell(this.readModel(), { type: 'pointerLockLost', reason }));
    useInputStore.getState().setPointerLocked(false);
  };

  private scheduleEscapeReset(): void {
    if (!this.escapeGate.seenWhileLocked && !this.escapeGate.swallowNext) return;
    const generation = this.escapeReset + 1;
    this.escapeReset = generation;
    window.setTimeout(() => {
      if (generation !== this.escapeReset) return;
      this.escapeGate = idleEscapeGate;
    }, 200);
  }

  private onLockError = (): void => {
    if (!this.pendingLock) return;
    this.pendingLock = false;
    this.lockGeneration += 1;
    this.apply(reduceShell(this.readModel(), { type: 'pointerLockRejected' }));
  };
}

export const inputManager = new InputManager();
