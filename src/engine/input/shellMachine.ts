import type { ShellState } from '@/contracts/input';

/**
 * Why the browser dropped pointer lock.
 * `toggle` is Q (we called exitPointerLock). `escape` is the browser's own unlock.
 * `blur` / `hidden` are focus loss and must not land on SCREEN.
 */
export type UnlockReason = 'escape' | 'toggle' | 'blur' | 'hidden';

export type ShellEvent =
  | { type: 'toggleScreen' }
  | { type: 'escape' }
  | { type: 'clickEmptyWorld' }
  | { type: 'blur' }
  | { type: 'tabHidden' }
  | { type: 'pointerLockGained' }
  | { type: 'pointerLockLost'; reason: UnlockReason }
  | { type: 'pointerLockRejected' };

export interface ShellModel {
  state: ShellState;
  /** Set after a rejected lock. The machine will not request again until a new gesture. */
  relockBlocked: boolean;
  showClickToWalk: boolean;
}

export type ShellEffect =
  | { type: 'requestPointerLock' }
  | { type: 'exitPointerLock'; intent: 'toggle' | 'lost' };

export const initialShellModel: ShellModel = {
  state: 'RELEASED',
  relockBlocked: false,
  showClickToWalk: true,
};

const released: ShellModel = {
  state: 'RELEASED',
  relockBlocked: false,
  showClickToWalk: true,
};

const screen: ShellModel = {
  state: 'SCREEN',
  relockBlocked: false,
  showClickToWalk: false,
};

const world: ShellModel = {
  state: 'WORLD',
  relockBlocked: false,
  showClickToWalk: false,
};

/**
 * A tab we opened ourselves must not drop SCREEN when the page hides.
 * `holding` stays set until the page is visible again, so a two-minute trip still returns to SCREEN.
 */
export function externalOpenKeepsScreen(
  now: number,
  openedUntil: number,
  holding: boolean,
  hidden: boolean,
): { holding: boolean; stay: boolean } {
  if (!hidden) return { holding: false, stay: false };
  if (holding || now < openedUntil) return { holding: true, stay: true };
  return { holding: false, stay: false };
}

function none(model: ShellModel): { model: ShellModel; effects: ShellEffect[] } {
  return { model, effects: [] };
}

/**
 * Pure WORLD / SCREEN / RELEASED transitions.
 * A rejected lock returns no `requestPointerLock` effect, so callers cannot loop on the error.
 */
export function reduceShell(
  model: ShellModel,
  event: ShellEvent,
): { model: ShellModel; effects: ShellEffect[] } {
  switch (event.type) {
    case 'blur':
    case 'tabHidden':
      return {
        model: released,
        effects: model.state === 'WORLD' ? [{ type: 'exitPointerLock', intent: 'lost' }] : [],
      };

    case 'pointerLockLost': {
      if (event.reason === 'blur' || event.reason === 'hidden') {
        return none(released);
      }
      if (model.state === 'RELEASED') {
        return none(model);
      }
      return none(screen);
    }

    case 'pointerLockGained':
      return none(world);

    case 'pointerLockRejected':
      return none({
        state: model.state === 'WORLD' ? 'RELEASED' : model.state,
        relockBlocked: true,
        showClickToWalk: true,
      });

    case 'toggleScreen':
      if (model.state === 'WORLD') {
        return { model: screen, effects: [{ type: 'exitPointerLock', intent: 'toggle' }] };
      }
      if (model.state === 'SCREEN') {
        return {
          model: { ...model, relockBlocked: false },
          effects: [{ type: 'requestPointerLock' }],
        };
      }
      return none(screen);

    case 'escape':
      if (model.state === 'SCREEN') {
        return none(released);
      }
      return none(model);

    case 'clickEmptyWorld':
      if (model.state === 'WORLD') {
        return none(model);
      }
      return {
        model: { ...model, relockBlocked: false },
        effects: [{ type: 'requestPointerLock' }],
      };

    default:
      return none(model);
  }
}

/** Blur and a hidden tab win over Q and Esc. Used to coalesce the browser events. */
export function classifyLockLoss(input: {
  requestedToggle: boolean;
  hidden: boolean;
  focused: boolean;
}): UnlockReason {
  if (input.hidden) return 'hidden';
  if (!input.focused) return 'blur';
  if (input.requestedToggle) return 'toggle';
  return 'escape';
}
