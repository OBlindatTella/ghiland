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
  let vx = x * speed;
  let vz = z * speed;
  const backpedal = input.back && !input.forward;
  if (backpedal) {
    const cap = speed * spec.backMultiplier;
    const magnitude = Math.hypot(vx, vz);
    if (magnitude > cap) {
      vx *= cap / magnitude;
      vz *= cap / magnitude;
    }
  }
  return { x: vx, z: vz };
}

/**
 * Yaw 0 faces +Z. Positive yaw turns toward +X, which is screen-left.
 * Mouse-right therefore decreases yaw, toward screen-right (world −X).
 * `wish.z` is forward, `wish.x` is right, both in view space.
 */
export function viewToWorld(wish: { x: number; z: number }, yaw: number): { x: number; z: number } {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: -wish.x * cos + wish.z * sin,
    z: wish.x * sin + wish.z * cos,
  };
}

/** Shared with the camera. A positive `movementX` (mouse right) yaws toward screen-right. */
export function yawFromMouse(movementX: number, sensitivity: number): number {
  return -movementX * sensitivity;
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

/** Counts. The first moments after lock use this floor so a spike cannot pass while the average is still 0. */
export const LOOK_GUARD_MS = 200;
const LOOK_FLOOR = 8;
const LOOK_SPIKE_RATIO = 3;

/**
 * Clamp the look vector to 3× a floor (during the post-lock guard) or 3× the rolling average.
 * The average is fed the clamped magnitude, so one spike does not raise the next threshold.
 */
export function clampLookVector(
  dx: number,
  dy: number,
  rollingAverage: number,
  guard: boolean,
): { dx: number; dy: number; average: number } {
  const magnitude = Math.hypot(dx, dy);
  const basis = guard ? LOOK_FLOOR : Math.max(rollingAverage, LOOK_FLOOR);
  const cap = basis * LOOK_SPIKE_RATIO;
  let outX = dx;
  let outY = dy;
  if (magnitude > cap && magnitude > 0) {
    const scale = cap / magnitude;
    outX *= scale;
    outY *= scale;
  }
  const used = Math.hypot(outX, outY);
  return { dx: outX, dy: outY, average: rollingAverage * 0.9 + used * 0.1 };
}
