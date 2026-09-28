/**
 * One physical Esc while the pointer is locked must open SCREEN, not fall through to RELEASED.
 * Chrome may deliver the keydown before or after `pointerlockchange`.
 */
export interface EscapeGate {
  seenWhileLocked: boolean;
  swallowNext: boolean;
  /** Esc arrived while a Q unlock was already in flight. Apply it after that unlock. */
  escapeAfterToggle: boolean;
}

export const idleEscapeGate: EscapeGate = {
  seenWhileLocked: false,
  swallowNext: false,
  escapeAfterToggle: false,
};

export function onEscapeKey(
  gate: EscapeGate,
  pointerLocked: boolean,
  toggleUnlockPending = false,
): { gate: EscapeGate; apply: boolean } {
  if (pointerLocked && toggleUnlockPending) {
    return {
      gate: { seenWhileLocked: false, swallowNext: false, escapeAfterToggle: true },
      apply: false,
    };
  }
  if (pointerLocked) {
    return {
      gate: { seenWhileLocked: true, swallowNext: false, escapeAfterToggle: false },
      apply: false,
    };
  }
  if (gate.seenWhileLocked || gate.swallowNext) {
    return { gate: idleEscapeGate, apply: false };
  }
  return { gate, apply: true };
}

/** Call when the browser drops the lock because of Esc, not because of blur or Q. */
export function onBrowserEscapeUnlock(gate: EscapeGate): EscapeGate {
  if (gate.seenWhileLocked) return idleEscapeGate;
  return { seenWhileLocked: false, swallowNext: true, escapeAfterToggle: false };
}

/** Q dropped the lock. A concurrent Esc is applied by the caller instead of being swallowed. */
export function onToggleUnlock(gate: EscapeGate): { gate: EscapeGate; applyEscape: boolean } {
  return { gate: idleEscapeGate, applyEscape: gate.escapeAfterToggle };
}
