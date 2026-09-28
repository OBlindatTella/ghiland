import { describe, expect, it } from 'vitest';
import { idleEscapeGate, onBrowserEscapeUnlock, onEscapeKey, onToggleUnlock, ESCAPE_SWALLOW_MS } from '@/engine/input/escapeGate';

describe('escape gate', () => {
  it('ignores Esc while locked and still accepts a later Esc once SCREEN is open', () => {
    const first = onEscapeKey(idleEscapeGate, true);
    expect(first.apply).toBe(false);
    const unlocked = onBrowserEscapeUnlock(first.gate);
    expect(unlocked).toEqual(idleEscapeGate);
    expect(onEscapeKey(unlocked, false).apply).toBe(true);
  });

  it('swallows the keydown that arrives after the browser has already unlocked', () => {
    const unlocked = onBrowserEscapeUnlock(idleEscapeGate);
    const key = onEscapeKey(unlocked, false);
    expect(key.apply).toBe(false);
    expect(onEscapeKey(key.gate, false).apply).toBe(true);
  });

  it('still swallows that keydown with no clock, including after a long hitch', () => {
    const unlocked = onBrowserEscapeUnlock(idleEscapeGate, 1_000);
    expect(onEscapeKey(unlocked, false, false, 1_000 + 500).apply).toBe(false);
  });

  it('lets a later Esc through once the swallow has expired', () => {
    const unlocked = onBrowserEscapeUnlock(idleEscapeGate, 1_000);
    const late = onEscapeKey(unlocked, false, false, 1_000 + ESCAPE_SWALLOW_MS + 1);
    expect(late.apply).toBe(true);
    expect(late.gate.swallowNext).toBe(false);
  });

  it('keeps an Esc that arrives while Q is already unlocking, and applies it after', () => {
    const during = onEscapeKey(idleEscapeGate, true, true);
    expect(during.apply).toBe(false);
    expect(during.gate.escapeAfterToggle).toBe(true);
    const toggle = onToggleUnlock(during.gate);
    expect(toggle.applyEscape).toBe(true);
    expect(toggle.gate).toEqual(idleEscapeGate);
  });
});
