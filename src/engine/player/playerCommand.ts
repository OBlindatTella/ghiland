export interface PlayerTransform {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Written by the test hook. The controller applies it once, on the next frame, and zeroes velocity. */
export const playerCommand: { current: PlayerTransform | null } = { current: null };

export function queuePlayerTransform(next: PlayerTransform): void {
  playerCommand.current = next;
}

export function takePlayerTransform(): PlayerTransform | null {
  const next = playerCommand.current;
  playerCommand.current = null;
  return next;
}
