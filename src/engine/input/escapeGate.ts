/**
 * One physical Esc while the pointer is locked must open SCREEN, not fall through to RELEASED.
 * Chrome may deliver the keydown before or after `pointerlockchange`.
 * A swallow with no matching key expires, so a later Esc still leaves the Screen.
 */
export interface EscapeGate {
  seenWhileLocked: boolean;
  swallowNext: boolean;
  /** Esc arrived while a Q unlock was already in flight. Apply it after that unlock. */
  escapeAfterToggle: boolean;
  /** `swallowNext` is ignored after this timestamp. 0 means there is nothing to expire. */
  swallowUntil: number;
}

export const ESCAPE_SWALLOW_MS = 2000;

export const idleEscapeGate: EscapeGate = {
  seenWhileLocked: false,
  swallowNext: false,
  escapeAfterToggle: false,
  swallowUntil: 0,
};

export function onEscapeKey(
  gate: EscapeGate,
  pointerLocked: boolean,
  toggleUnlockPending = false,
  now = Date.now(),
): { gate: EscapeGate; apply: boolean } {
  if (pointerLocked && toggleUnlockPending) {
    return {
      gate: { seenWhileLocked: false, swallowNext: false, escapeAfterToggle: true, swallowUntil: 0 },
      apply: false,
    };
  }
  if (pointerLocked) {
    return {
      gate: { seenWhileLocked: true, swallowNext: false, escapeAfterToggle: false, swallowUntil: 0 },
      apply: false,
    };
  }
  const swallowFresh = gate.swallowNext && (gate.swallowUntil === 0 || now <= gate.swallowUntil);
  if (gate.seenWhileLocked || swallowFresh) {
    return { gate: idleEscapeGate, apply: false };
  }
  return { gate: idleEscapeGate, apply: true };
}

/** Call when the browser drops the lock because of Esc, not because of blur or Q. */
export function onBrowserEscapeUnlock(gate: EscapeGate, now = Date.now()): EscapeGate {
  if (gate.seenWhileLocked) return idleEscapeGate;
  return {
    seenWhileLocked: false,
    swallowNext: true,
    escapeAfterToggle: false,
    swallowUntil: now + ESCAPE_SWALLOW_MS,
  };
}

/** Q dropped the lock. A concurrent Esc is applied by the caller instead of being swallowed. */
export function onToggleUnlock(gate: EscapeGate): { gate: EscapeGate; applyEscape: boolean } {
  return { gate: idleEscapeGate, applyEscape: gate.escapeAfterToggle };
}
