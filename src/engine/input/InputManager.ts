import type { Action, InputOwner, ShellState } from '@/contracts/input';
import { bus } from '@/engine/events/bus';
import { defaultBindings } from '@/engine/input/bindings';
import { decideKey, isEditableElement } from '@/engine/input/keyRoute';
import { KeyState } from '@/engine/input/keyState';
import { ownerForShell, OwnerStack } from '@/engine/input/ownerStack';
import { requestCanvasPointerLock } from '@/engine/input/pointerLock';
import { isWindowTarget } from '@/engine/windows/windowTarget';
import { idleEscapeGate, onBrowserEscapeUnlock, onEscapeKey, onToggleUnlock, type EscapeGate } from '@/engine/input/escapeGate';
import { classifyLockLoss, externalOpenKeepsScreen, reduceShell, type ShellEffect, type ShellModel } from '@/engine/input/shellMachine';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { useScreenStore } from '@/state/screen';

export class InputManager {
  private keys = new KeyState();
  private owners = new OwnerStack('ui');
  private canvas: HTMLElement | null = null;
  private pendingLock = false;
  private acceptLock = false;
  /** pointerlockerror events to ignore while the unadjustedMovement retry is in flight. */
  private lockErrorsToIgnore = 0;
  /** Context loss and other system exits must not be classified as an Esc unlock. */
  private systemUnlock = false;
  /** A second Q arrived while the first Q's exit was still in flight. */
  private relockAfterToggle = false;
  private unlockIntent: 'toggle' | null = null;
  private lockGeneration = 0;
  private escapeGate: EscapeGate = idleEscapeGate;
  private systemToken: number | null = null;
  private blurTimer = 0;
  private press: { x: number; y: number } | null = null;
  private beforeShell: ((from: ShellState, to: ShellState) => void) | null = null;
  /** Blur, tab hide, or context loss, including when the shell was already RELEASED (S6-10). */
  private onFocusLoss: (() => void) | null = null;
  /** Ignore blur and tab-hide caused by our own window.open, so the Web tile stays on SCREEN. */
  private externalOpenUntil = 0;
  private externalHold = false;
  /** True from compositionstart until compositionend. */
  private composing = false;
  /** The Escape that ends a composition must not also blur or step the shell. */
  private compositionEscape = false;
  private compositionTimer = 0;
  /**
   * Key that arrived while a composition was open.
   * Chrome delivers the composing Escape before compositionend; arming after that swallows the next Esc.
   * Null means the ending key has not been seen yet (Safari delivers it after compositionend).
   */
  private compositionKey: string | null = null;

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
    document.addEventListener('compositionstart', this.onCompositionStart);
    document.addEventListener('compositionend', this.onCompositionEnd);
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
    document.removeEventListener('compositionstart', this.onCompositionStart);
    document.removeEventListener('compositionend', this.onCompositionEnd);
    this.composing = false;
    this.compositionEscape = false;
    this.compositionKey = null;
    window.clearTimeout(this.compositionTimer);
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
    const token = this.owners.push(owner);
    this.publishOwner();
    return token;
  }

  popOwner(token: number): void {
    this.owners.pop(token);
    this.publishOwner();
  }

  private publishOwner(): void {
    const owner = this.owners.current();
    if (useInputStore.getState().owner !== owner) useInputStore.setState({ owner });
  }

  isActionDown(action: Action): boolean {
    const binding = defaultBindings.find((item) => item.action === action);
    if (!binding || !binding.owners.includes(this.owners.current())) return false;
    return binding.codes.some((code) => this.keys.isDown(code));
  }

  clickEmptyWorld(): void {
    if (!this.gameplayOpen()) return;
    this.apply(reduceShell(this.readModel(), { type: 'clickEmptyWorld' }));
  }

  /** Loading and the arrival fade ignore keys, clicks, and pointer lock. */
  private gameplayOpen(): boolean {
    return useSession.getState().worldPhase === 'active';
  }

  /** D-017. Runs before the store write so a carried window can pin on the way out of WORLD. */
  setBeforeShellChange(hook: ((from: ShellState, to: ShellState) => void) | null): void {
    this.beforeShell = hook;
  }

  /** D-038 Q12. Runs on blur, hide, and context loss even when the shell state does not change. */
  setOnFocusLoss(hook: (() => void) | null): void {
    this.onFocusLoss = hook;
  }

  private windowHooks: { pin?: () => void; interact?: () => void; recall?: () => void } | null = null;

  /** Installed by the window rig. Absent until a world canvas is mounted. */
  setWindowHooks(hooks: { pin?: () => void; interact?: () => void; recall?: () => void } | null): void {
    this.windowHooks = hooks;
  }

  /** Leave WORLD for SCREEN without treating it as Q's recall. */
  presentScreen(): void {
    if (!this.gameplayOpen()) return;
    if (this.readModel().state !== 'WORLD') return;
    this.apply(reduceShell(this.readModel(), { type: 'toggleScreen' }));
  }

  noteExternalOpen(): void {
    this.externalOpenUntil = Date.now() + 500;
  }

  /** Detach closes the Screen and asks for pointer lock. A denied lock stays RELEASED, still carrying. */
  presentWorld(): void {
    if (!this.gameplayOpen()) return;
    if (this.readModel().state === 'WORLD') return;
    this.apply(reduceShell(this.readModel(), { type: 'carryIntoWorld' }));
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
    if (!canvas || this.pendingLock || !this.gameplayOpen()) return;
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
    if (!this.gameplayOpen()) return;
    if (useInputStore.getState().shellState === 'WORLD') return;
    if (isWindowTarget(event)) return;
    this.press = { x: event.clientX, y: event.clientY };
  };

  private onClick = (event: MouseEvent): void => {
    if (!this.gameplayOpen()) return;
    if (useInputStore.getState().shellState === 'WORLD') return;
    if (isWindowTarget(event)) return;
    const origin = this.press;
    this.press = null;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (dx * dx + dy * dy > 16) return;
    this.clickEmptyWorld();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const duringComposition = this.composing || Boolean(event.isComposing) || event.keyCode === 229;
    if (duringComposition && event.code) this.compositionKey = event.code;
    if (!this.gameplayOpen()) return;
    const editable = isEditableElement(event.target) || isEditableElement(document.activeElement);
    const composing =
      duringComposition ||
      (event.code === 'Escape' && this.compositionEscape);
    if (this.compositionEscape) {
      this.compositionEscape = false;
      window.clearTimeout(this.compositionTimer);
    }
    const decision = decideKey(
      event.code,
      editable,
      this.owners.current(),
      document.pointerLockElement !== null,
      event.repeat,
      undefined,
      composing,
    );
    if (decision.track) this.keys.keyDown(event.code);
    if (decision.preventDefault) event.preventDefault();
    if (decision.blurEditable) {
      const active = document.activeElement as { blur?: () => void } | null;
      active?.blur?.();
      return;
    }
    if (decision.action === 'toggleScreen') {
      this.windowHooks?.recall?.();
      this.apply(reduceShell(this.readModel(), { type: 'toggleScreen' }));
    } else if (decision.action === 'pin') {
      this.windowHooks?.pin?.();
    } else if (decision.action === 'interact') {
      this.windowHooks?.interact?.();
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
    } else if (decision.action === 'openLauncher') {
      const stack = useScreenStore.getState().stack;
      if (!stack.includes('text') && !stack.includes('settings')) useScreenStore.getState().push('launcher');
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.keyUp(event.code);
  };

  private onCompositionStart = (): void => {
    this.composing = true;
    this.compositionEscape = false;
    this.compositionKey = null;
    window.clearTimeout(this.compositionTimer);
  };

  private onCompositionEnd = (): void => {
    this.composing = false;
    const endingKey = this.compositionKey;
    this.compositionKey = null;
    window.clearTimeout(this.compositionTimer);
    // Arm only for the Safari order: no keydown was seen during the composition, so the
    // ending Escape still follows compositionend. A composing Escape (Chrome) or a commit
    // via Enter must not arm the flag. It lasts only until the next turn (S6-14).
    if (endingKey !== null) {
      this.compositionEscape = false;
      return;
    }
    this.compositionEscape = true;
    this.compositionTimer = window.setTimeout(() => {
      this.compositionEscape = false;
    }, 0);
  };

  private onBlur = (): void => {
    window.clearTimeout(this.blurTimer);
    // Focus moving into an iframe blurs the parent window while document.hasFocus() stays true.
    // A popup that never hides the page must not stick the external-open hold (S5-15).
    this.blurTimer = window.setTimeout(() => {
      if (!this.canvas) return;
      if (this.externalHold) return;
      const active = document.activeElement as { tagName?: string } | null;
      if (document.hasFocus() && active?.tagName === 'IFRAME') return;
      this.keys.clear();
      this.unlockIntent = null;
      this.onFocusLoss?.();
      this.apply(reduceShell(this.readModel(), { type: 'blur' }));
    }, 0);
  };

  private onVisibility = (): void => {
    const held = externalOpenKeepsScreen(Date.now(), this.externalOpenUntil, this.externalHold, document.hidden);
    this.externalHold = held.holding;
    if (!document.hidden || held.stay) return;
    this.keys.clear();
    this.unlockIntent = null;
    this.onFocusLoss?.();
    this.apply(reduceShell(this.readModel(), { type: 'tabHidden' }));
  };

  private onLockChange = (): void => {
    const locked = this.canvas !== null && document.pointerLockElement === this.canvas;
    this.pendingLock = false;
    if (!locked && this.systemUnlock) {
      this.systemUnlock = false;
      this.escapeGate = idleEscapeGate;
      this.acceptLock = false;
      this.unlockIntent = null;
      useInputStore.getState().setPointerLocked(false);
      return;
    }
    if (locked) {
      if (!this.acceptLock) {
        this.systemUnlock = true;
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
      this.cancelPendingLock();
      return;
    }
    this.apply(reduceShell(this.readModel(), { type: 'escape' }));
  }

  holdSystem(): void {
    if (this.systemToken !== null) return;
    this.systemToken = this.pushOwner('system');
  }

  /** D-017. Context loss goes through apply so the pointer, gate, and auto-pin hook all run. */
  loseContext(): void {
    this.holdSystem();
    this.escapeGate = idleEscapeGate;
    this.systemUnlock = Boolean(document.pointerLockElement);
    this.cancelPendingLock();
    this.unlockIntent = null;
    this.relockAfterToggle = false;
    this.releasePointerLock();
    useInputStore.getState().setPointerLocked(false);
    this.onFocusLoss?.();
    this.apply(reduceShell(this.readModel(), { type: 'blur' }));
  }

  private releasePointerLock(): void {
    const exit = () => {
      if (typeof document === 'undefined' || !document.pointerLockElement) return;
      document.exitPointerLock();
    };
    exit();
    if (typeof queueMicrotask === 'function') queueMicrotask(exit);
    window.setTimeout(exit, 0);
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

export const inputManager = new InputManager();
