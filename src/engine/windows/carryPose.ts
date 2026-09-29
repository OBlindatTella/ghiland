import type { Quat, Vec3 } from '@/contracts/math';
import { CARRY_DISTANCE } from '@/engine/windows/placement';

const STIFFNESS = 260;
const DAMPING = 32;

export interface CarryPose {
  position: Vec3;
  quaternion: Quat;
}

interface Spring {
  position: [number, number, number];
  velocity: [number, number, number];
  quaternion: Quat;
}

const springs = new Map<string, Spring>();

function nlerp(from: Quat, to: Quat, t: number): Quat {
  let bx = to[0];
  let by = to[1];
  let bz = to[2];
  let bw = to[3];
  if (from[0] * bx + from[1] * by + from[2] * bz + from[3] * bw < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  const next: Quat = [
    from[0] + (bx - from[0]) * t,
    from[1] + (by - from[1]) * t,
    from[2] + (bz - from[2]) * t,
    from[3] + (bw - from[3]) * t,
  ];
  const length = Math.hypot(next[0], next[1], next[2], next[3]) || 1;
  return [next[0] / length, next[1] / length, next[2] / length, next[3] / length];
}

export function seedCarry(id: string, position: Vec3, quaternion: Quat): void {
  springs.set(id, { position: [...position], velocity: [0, 0, 0], quaternion: [...quaternion] });
}

export function readCarry(id: string): CarryPose | null {
  const spring = springs.get(id);
  if (!spring) return null;
  return { position: [...spring.position], quaternion: [...spring.quaternion] };
}

export function clearCarry(id: string): void {
  springs.delete(id);
}

const SUBSTEP = 1 / 60;

function integrate(spring: Spring, target: CarryPose, step: number): void {
  const alpha = 1 - Math.exp(-step / 0.15);
  spring.quaternion = nlerp(spring.quaternion, target.quaternion, alpha);
  for (let axis = 0; axis < 3; axis += 1) {
    const accel = STIFFNESS * (target.position[axis] - spring.position[axis]) - DAMPING * spring.velocity[axis];
    spring.velocity[axis] += accel * step;
    spring.position[axis] += spring.velocity[axis] * step;
  }
}

/** Critically damped follow (Pixel stiffness 260, damping 32). Substepped so 20 fps does not ring. */
export function stepCarry(id: string, target: CarryPose, dt: number): CarryPose {
  const total = Math.min(0.05, Math.max(0, dt));
  let spring = springs.get(id);
  if (!spring) {
    spring = { position: [...target.position], velocity: [0, 0, 0], quaternion: [...target.quaternion] };
    springs.set(id, spring);
  }
  let left = total;
  if (left === 0) return { position: [...spring.position], quaternion: [...spring.quaternion] };
  while (left > 1e-6) {
    const step = Math.min(SUBSTEP, left);
    integrate(spring, target, step);
    left -= step;
  }
  return { position: [...spring.position], quaternion: [...spring.quaternion] };
}

export function carryTarget(origin: Vec3, forward: Vec3, quaternion: Quat): CarryPose {
  return {
    position: [
      origin[0] + forward[0] * CARRY_DISTANCE,
      origin[1] + forward[1] * CARRY_DISTANCE,
      origin[2] + forward[2] * CARRY_DISTANCE,
    ],
    quaternion,
  };
}
