import type { Action, InputOwner, ShellState } from '@/contracts/input';
import { bus } from '@/engine/events/bus';
import { defaultBindings } from '@/engine/input/bindings';
import { decideKey, isEditableElement } from '@/engine/input/keyRoute';
import { KeyState } from '@/engine/input/keyState';
import { ownerForShell, OwnerStack } from '@/engine/input/ownerStack';
import { requestCanvasPointerLock } from '@/engine/input/pointerLock';
import { idleEscapeGate, onBrowserEscapeUnlock, onEscapeKey, onToggleUnlock, type EscapeGate } from '@/engine/input/escapeGate';
import { classifyLockLoss, reduceShell, type ShellEffect, type ShellModel } from '@/engine/input/shellMachine';
import { useInputStore } from '@/state/input';
import { useSettings } from '@/state/settings';
import { useScreenStore } from '@/state/screen';

export class InputManager {
  private keys = new KeyState();
  private owners = new OwnerStack('ui');
  private canvas: HTMLElement | null = null;
  private pendingLock = false;
  /** One pointerlockerror from an unsupported unadjustedMovement option is not a rejection. */
  private lockErrorsToIgnore = 0;
  /** A second Q arrived while the first Q's exit was still in flight. */
  private relockAfterToggle = false;
  private unlockIntent: 'toggle' | null = null;
  private lockGeneration = 0;
  private escapeGate: EscapeGate = idleEscapeGate;
  private systemToken: number | null = null;
  private blurTimer = 0;
  private press: { x: number; y: number } | null = null;
  private beforeShell: ((from: ShellState, to: ShellState) => void) | null = null;

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
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('click', this.onClick);
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
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('click', this.onClick);
    window.clearTimeout(this.blurTimer);
    this.canvas = null;
    this.pendingLock = false;
    this.acceptLock = false;
    this.lockErrorsToIgnore = 0;
    this.relockAfterToggle = false;
  }

  pushOwner(owner: InputOwner): number {
    return this.owners.push(owner);
  }

  popOwner(token: number): void {
    this.owners.pop(token);
  }

  isActionDown(action: Action): boolean {
    const binding = defaultBindings.find((item) => item.action === action);
    if (!binding || !binding.owners.includes(this.owners.current())) return false;
    return binding.codes.some((code) => this.keys.isDown(code));
  }

  clickEmptyWorld(): void {
    this.apply(reduceShell(this.readModel(), { type: 'clickEmptyWorld' }));
  }

  /** D-017. Runs before the store write so a carried window can pin on the way out of WORLD. */
  setBeforeShellChange(hook: ((from: ShellState, to: ShellState) => void) | null): void {
    this.beforeShell = hook;
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
    if (previous !== result.model.state) this.beforeShell?.(previous, result.model.state);
    const requesting = result.effects.some((effect) => effect.type === 'requestPointerLock');
    if (!requesting && (this.pendingLock || this.acceptLock)) this.cancelPendingLock();
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
      if (this.unlockIntent === 'toggle') {
        this.relockAfterToggle = true;
        return;
      }
      this.apply(reduceShell(this.readModel(), { type: 'pointerLockGained' }));
      useInputStore.getState().setPointerLocked(true);
      return;
    }
    this.pendingLock = true;
    this.acceptLock = true;
    const generation = this.lockGeneration + 1;
    this.lockGeneration = generation;
    const fail = () => {
      if (generation !== this.lockGeneration || !this.pendingLock) return;
      this.pendingLock = false;
      this.acceptLock = false;
      this.lockErrorsToIgnore = 0;
      this.lockGeneration += 1;
      this.apply(reduceShell(this.readModel(), { type: 'pointerLockRejected' }));
    };
    this.lockErrorsToIgnore = 1;
    const outcome = requestCanvasPointerLock(canvas);
    if (outcome === 'event') {
      this.lockErrorsToIgnore = 0;
      return;
    }
    void outcome.then(
      () => {
        if (generation !== this.lockGeneration) return;
        this.pendingLock = false;
      },
      () => {
        this.lockErrorsToIgnore = 0;
        fail();
      },
    );
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (useInputStore.getState().shellState === 'WORLD') return;
    if (isWindowTarget(event.target)) return;
    this.press = { x: event.clientX, y: event.clientY };
  };

  private onClick = (event: MouseEvent): void => {
    if (useInputStore.getState().shellState === 'WORLD') return;
    if (isWindowTarget(event.target)) return;
    const origin = this.press;
    this.press = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (dx * dx + dy * dy > 16) return;
    this.clickEmptyWorld();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const editable = isEditableElement(event.target) || isEditableElement(document.activeElement);
    const decision = decideKey(
      event.code,
      editable,
      this.owners.current(),
      document.pointerLockElement !== null,
      event.repeat,
    );
    if (decision.track) this.keys.keyDown(event.code);
    if (decision.preventDefault) event.preventDefault();
    if (decision.blurEditable) {
      const active = document.activeElement as { blur?: () => void } | null;
      active?.blur?.();
      return;
    }
    if (decision.action === 'toggleScreen') {
      this.apply(reduceShell(this.readModel(), { type: 'toggleScreen' }));
    } else if (decision.action === 'escape') {
      const next = onEscapeKey(
        this.escapeGate,
        document.pointerLockElement !== null,
        this.unlockIntent === 'toggle',
      );
      this.escapeGate = next.gate;
      if (next.gate.escapeAfterToggle) this.relockAfterToggle = false;
      if (next.apply) this.applyEscape();
    } else if (decision.action === 'toggleMute') {
      useSettings.getState().toggleMuted();
    } else if (decision.action === 'togglePerfHud') {
      useSettings.getState().togglePerf();
    } else if (!editable && !event.repeat && event.code === 'Slash' && useInputStore.getState().shellState === 'SCREEN') {
      const stack = useScreenStore.getState().stack;
      if (!stack.includes('text') && !stack.includes('settings')) useScreenStore.getState().push('launcher');
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.keyUp(event.code);
  };

  private onBlur = (): void => {
    window.clearTimeout(this.blurTimer);
    // Focus moving into an iframe blurs the parent window while document.hasFocus() stays true.
    this.blurTimer = window.setTimeout(() => {
      if (!this.canvas) return;
      const active = document.activeElement as { tagName?: string } | null;
      if (document.hasFocus() && active?.tagName === 'IFRAME') return;
      this.keys.clear();
      this.unlockIntent = null;
      this.apply(reduceShell(this.readModel(), { type: 'blur' }));
    }, 0);
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
      if (!this.acceptLock) {
        document.exitPointerLock();
        return;
      }
      this.acceptLock = false;
      this.lockErrorsToIgnore = 0;
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
    const follow = reason === 'toggle' ? onToggleUnlock(this.escapeGate) : null;
    const relock = reason === 'toggle' && this.relockAfterToggle && !follow?.applyEscape;
    this.relockAfterToggle = false;
    this.unlockIntent = null;
    if (reason === 'escape') {
      this.escapeGate = onBrowserEscapeUnlock(this.escapeGate);
    } else if (follow) {
      this.escapeGate = follow.gate;
    } else {
      this.escapeGate = idleEscapeGate;
    }
    this.apply(reduceShell(this.readModel(), { type: 'pointerLockLost', reason }));
    useInputStore.getState().setPointerLocked(false);
    if (follow?.applyEscape) this.applyEscape();
    else if (relock) this.requestLock();
  };

  private cancelPendingLock(): void {
    this.pendingLock = false;
    this.acceptLock = false;
    this.lockErrorsToIgnore = 0;
    this.lockGeneration += 1;
  }

  private applyEscape(): void {
    if (useInputStore.getState().shellState === 'SCREEN' && !useScreenStore.getState().pop().release) {
      return;
    }
    this.apply(reduceShell(this.readModel(), { type: 'escape' }));
  }

  holdSystem(): void {
    if (this.systemToken !== null) return;
    this.systemToken = this.pushOwner('system');
  }

  releaseSystem(): void {
    if (this.systemToken === null) return;
    this.popOwner(this.systemToken);
    this.systemToken = null;
  }

  private onLockError = (): void => {
    if (this.lockErrorsToIgnore > 0) {
      this.lockErrorsToIgnore -= 1;
      return;
    }
    if (!this.pendingLock) return;
    this.pendingLock = false;
    this.acceptLock = false;
    this.lockGeneration += 1;
    this.apply(reduceShell(this.readModel(), { type: 'pointerLockRejected' }));
  };
}

function isWindowTarget(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  return Boolean(element?.closest?.('[data-ghiland-window]'));
}

export const inputManager = new InputManager();
