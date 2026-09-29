import { describe, expect, it } from 'vitest';
import { ownerForShell, OwnerStack } from '@/engine/input/ownerStack';
import { KeyState } from '@/engine/input/keyState';
import {
  classifyLockLoss,
  externalOpenKeepsScreen,
  initialShellModel,
  reduceShell,
  type ShellEvent,
  type ShellModel,
} from '@/engine/input/shellMachine';

function apply(model: ShellModel, event: ShellEvent) {
  return reduceShell(model, event);
}

describe('external window.open', () => {
  it('keeps SCREEN while the page is hidden after our own open, including a later return', () => {
    const opened = externalOpenKeepsScreen(1_000, 1_500, false, true);
    expect(opened.stay).toBe(true);
    const stillGone = externalOpenKeepsScreen(120_000, 1_500, opened.holding, true);
    expect(stillGone.stay).toBe(true);
    const back = externalOpenKeepsScreen(130_000, 1_500, stillGone.holding, false);
    expect(back.holding).toBe(false);
    expect(back.stay).toBe(false);
    expect(externalOpenKeepsScreen(2_000, 1_500, false, true).stay).toBe(false);
  });
});

describe('reduceShell', () => {
  it('starts released with the click-to-walk hint', () => {
    expect(initialShellModel).toEqual({
      state: 'RELEASED',
      relockBlocked: false,
      showClickToWalk: true,
    });
    expect(ownerForShell(initialShellModel.state)).toBe('ui');
  });

  it('Q from WORLD exits the lock and opens SCREEN', () => {
    const world = apply(initialShellModel, { type: 'pointerLockGained' }).model;
    const next = apply(world, { type: 'toggleScreen' });
    expect(next.model.state).toBe('SCREEN');
    expect(next.model.showClickToWalk).toBe(false);
    expect(next.effects).toEqual([{ type: 'exitPointerLock', intent: 'toggle' }]);
    expect(ownerForShell(next.model.state)).toBe('ui');
  });

  it('Esc in WORLD, seen as a browser unlock, opens SCREEN', () => {
    const world = apply(initialShellModel, { type: 'pointerLockGained' }).model;
    const next = apply(world, { type: 'pointerLockLost', reason: 'escape' });
    expect(next.model.state).toBe('SCREEN');
    expect(next.effects).toEqual([]);
  });

  it('does not treat a keydown Escape in WORLD as ours to handle', () => {
    const world = apply(initialShellModel, { type: 'pointerLockGained' }).model;
    const next = apply(world, { type: 'escape' });
    expect(next.model.state).toBe('WORLD');
    expect(next.effects).toEqual([]);
  });

  it('Q from SCREEN requests a lock and does not enter WORLD until it is granted', () => {
    const screen = apply(
      apply(initialShellModel, { type: 'pointerLockGained' }).model,
      { type: 'toggleScreen' },
    ).model;
    const next = apply(screen, { type: 'toggleScreen' });
    expect(next.model.state).toBe('SCREEN');
    expect(next.effects).toEqual([{ type: 'requestPointerLock' }]);
    const locked = apply(next.model, { type: 'pointerLockGained' });
    expect(locked.model.state).toBe('WORLD');
    expect(locked.model.showClickToWalk).toBe(false);
    expect(ownerForShell(locked.model.state)).toBe('world');
  });

  it('a click on empty world from SCREEN requests a lock', () => {
    const screen = apply(
      apply(initialShellModel, { type: 'pointerLockGained' }).model,
      { type: 'pointerLockLost', reason: 'escape' },
    ).model;
    const next = apply(screen, { type: 'clickEmptyWorld' });
    expect(next.model.state).toBe('SCREEN');
    expect(next.effects).toEqual([{ type: 'requestPointerLock' }]);
  });

  it('Esc in SCREEN steps back to RELEASED and never re-locks', () => {
    const screen = apply(
      apply(initialShellModel, { type: 'pointerLockGained' }).model,
      { type: 'pointerLockLost', reason: 'escape' },
    ).model;
    const next = apply(screen, { type: 'escape' });
    expect(next.model.state).toBe('RELEASED');
    expect(next.model.showClickToWalk).toBe(true);
    expect(next.effects).toEqual([]);
  });

  it('a click from RELEASED requests a lock, and Q opens SCREEN without locking', () => {
    const click = apply(initialShellModel, { type: 'clickEmptyWorld' });
    expect(click.effects).toEqual([{ type: 'requestPointerLock' }]);
    expect(click.model.state).toBe('RELEASED');
    const screen = apply(initialShellModel, { type: 'toggleScreen' });
    expect(screen.model.state).toBe('SCREEN');
    expect(screen.effects).toEqual([]);
  });

  it.each(['blur', 'tabHidden'] as const)('%s from any state goes to RELEASED', (type) => {
    const world = apply(initialShellModel, { type: 'pointerLockGained' }).model;
    const screen = apply(world, { type: 'toggleScreen' }).model;
    for (const model of [world, screen, initialShellModel]) {
      const next = apply(model, { type });
      expect(next.model.state).toBe('RELEASED');
      expect(next.model.showClickToWalk).toBe(true);
      if (model.state === 'WORLD') {
        expect(next.effects).toEqual([{ type: 'exitPointerLock', intent: 'lost' }]);
      } else {
        expect(next.effects).toEqual([]);
      }
    }
  });

  it('a rejected re-lock stays put, shows the hint, and does not request again', () => {
    const screen = apply(initialShellModel, { type: 'toggleScreen' }).model;
    const asking = apply(screen, { type: 'toggleScreen' });
    expect(asking.effects).toEqual([{ type: 'requestPointerLock' }]);
    const rejected = apply(asking.model, { type: 'pointerLockRejected' });
    expect(rejected.model.state).toBe('SCREEN');
    expect(rejected.model.relockBlocked).toBe(true);
    expect(rejected.model.showClickToWalk).toBe(true);
    expect(rejected.effects).toEqual([]);
    const again = apply(rejected.model, { type: 'pointerLockRejected' });
    expect(again.effects).toEqual([]);
    expect(again.model.relockBlocked).toBe(true);
  });

  it('the next click or Q after a rejection is a new gesture and may lock once', () => {
    const rejected = apply(
      apply(initialShellModel, { type: 'clickEmptyWorld' }).model,
      { type: 'pointerLockRejected' },
    ).model;
    expect(rejected.state).toBe('RELEASED');
    const click = apply(rejected, { type: 'clickEmptyWorld' });
    expect(click.effects).toEqual([{ type: 'requestPointerLock' }]);
    expect(click.model.relockBlocked).toBe(false);

    const fromScreen = apply(
      apply(apply(initialShellModel, { type: 'toggleScreen' }).model, { type: 'toggleScreen' }).model,
      { type: 'pointerLockRejected' },
    ).model;
    const q = apply(fromScreen, { type: 'toggleScreen' });
    expect(q.model.state).toBe('SCREEN');
    expect(q.effects).toEqual([{ type: 'requestPointerLock' }]);
  });

  it('an unlock that arrives after blur does not bounce back to SCREEN', () => {
    const world = apply(initialShellModel, { type: 'pointerLockGained' }).model;
    const blurred = apply(world, { type: 'blur' }).model;
    const late = apply(blurred, { type: 'pointerLockLost', reason: 'escape' });
    expect(late.model.state).toBe('RELEASED');
    expect(late.effects).toEqual([]);
  });
});

describe('classifyLockLoss', () => {
  it('prefers a hidden tab, then blur, then Q, then Esc', () => {
    expect(classifyLockLoss({ requestedToggle: true, hidden: true, focused: false })).toBe('hidden');
    expect(classifyLockLoss({ requestedToggle: true, hidden: false, focused: false })).toBe('blur');
    expect(classifyLockLoss({ requestedToggle: true, hidden: false, focused: true })).toBe('toggle');
    expect(classifyLockLoss({ requestedToggle: false, hidden: false, focused: true })).toBe('escape');
  });
});

describe('owner stack', () => {
  it('restores the shell owner when a nested text owner pops', () => {
    const stack = new OwnerStack('ui');
    stack.setBase('world');
    const token = stack.push('text');
    expect(stack.current()).toBe('text');
    stack.setBase('ui');
    expect(stack.current()).toBe('text');
    stack.pop(token);
    expect(stack.current()).toBe('ui');
    stack.pop(0);
    expect(stack.current()).toBe('ui');
  });
});

describe('key suppression', () => {
  it('ignores keys that were already held when the world takes the keyboard', () => {
    const keys = new KeyState();
    keys.keyDown('KeyW');
    keys.suppressHeld();
    expect(keys.isDown('KeyW')).toBe(false);
    keys.keyUp('KeyW');
    expect(keys.isDown('KeyW')).toBe(false);
    keys.keyDown('KeyW');
    expect(keys.isDown('KeyW')).toBe(true);
  });

  it('clears held keys on blur so returning does not resume walking', () => {
    const keys = new KeyState();
    keys.keyDown('KeyW');
    keys.clear();
    expect(keys.isDown('KeyW')).toBe(false);
  });
});
