/**
 * One physical Esc while the pointer is locked must open SCREEN, not fall through to RELEASED.
 * Chrome may deliver the keydown before or after `pointerlockchange`.
 */
export interface EscapeGate {
  seenWhileLocked: boolean;
  swallowNext: boolean;
}

export const idleEscapeGate: EscapeGate = {
  seenWhileLocked: false,
  swallowNext: false,
};

export function onEscapeKey(
  gate: EscapeGate,
  pointerLocked: boolean,
): { gate: EscapeGate; apply: boolean } {
  if (pointerLocked) {
    return { gate: { seenWhileLocked: true, swallowNext: false }, apply: false };
  }
  if (gate.seenWhileLocked || gate.swallowNext) {
    return { gate: idleEscapeGate, apply: false };
  }
  return { gate, apply: true };
}

/** Call when the browser drops the lock because of Esc, not because of blur or Q. */
export function onBrowserEscapeUnlock(gate: EscapeGate): EscapeGate {
  if (gate.seenWhileLocked) return idleEscapeGate;
  return { seenWhileLocked: false, swallowNext: true };
}
