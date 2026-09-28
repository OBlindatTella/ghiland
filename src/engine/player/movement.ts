import type { MovementSpec } from '@/contracts/input';

/** Aura §5. Shift is strollFast, not a sprint. There is no jump. */
export const DEFAULT_MOVEMENT: MovementSpec = {
  walkSpeed: 1.35,
  strollFastSpeed: 2.2,
  backMultiplier: 0.8,
  strafeMultiplier: 0.85,
  eyeHeight: 1.62,
  capsule: { height: 1.75, radius: 0.3 },
};

export const MAX_FRAME_DT = 0.05;
const ACCEL_TAU = 0.15;
const STOP_TAU = 0.2;
const PITCH_LIMIT = (80 * Math.PI) / 180;

export interface WishInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  strollFast: boolean;
}

export function clampFrameDt(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(dt, MAX_FRAME_DT);
}

/** View-space wish: +z forward, +x right. Diagonals are normalised so they are not faster than straight. */
export function wishVelocity(input: WishInput, spec: MovementSpec = DEFAULT_MOVEMENT): { x: number; z: number } {
  let x = 0;
  let z = 0;
  if (input.forward) z += 1;
  if (input.back) z -= spec.backMultiplier;
  if (input.right) x += spec.strafeMultiplier;
  if (input.left) x -= spec.strafeMultiplier;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const speed = input.strollFast ? spec.strollFastSpeed : spec.walkSpeed;
  return { x: x * speed, z: z * speed };
}

/**
 * Yaw 0 faces +Z. Positive yaw turns toward +X.
 * `wish.z` is forward, `wish.x` is right, both in view space.
 */
export function viewToWorld(wish: { x: number; z: number }, yaw: number): { x: number; z: number } {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: wish.x * cos + wish.z * sin,
    z: -wish.x * sin + wish.z * cos,
  };
}

export function dampVec2(
  current: { x: number; z: number },
  target: { x: number; z: number },
  dt: number,
): { x: number; z: number } {
  const currentLen = Math.hypot(current.x, current.z);
  const targetLen = Math.hypot(target.x, target.z);
  const tau = targetLen > currentLen + 1e-4 ? ACCEL_TAU : STOP_TAU;
  const alpha = 1 - Math.exp(-dt / tau);
  return {
    x: current.x + (target.x - current.x) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch));
}

/** Clamp a single mouse delta to 3× the rolling average once that average is established. */
export function clampLookDelta(delta: number, rollingAverage: number): { delta: number; average: number } {
  const magnitude = Math.abs(delta);
  const average = rollingAverage * 0.9 + magnitude * 0.1;
  if (rollingAverage > 8 && magnitude > rollingAverage * 3) {
    return { delta: Math.sign(delta) * rollingAverage * 3, average };
  }
  return { delta, average };
}
