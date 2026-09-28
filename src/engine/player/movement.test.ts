import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  clampFrameDt,
  clampPitch,
  dampVec2,
  DEFAULT_MOVEMENT,
  viewToWorld,
  wishVelocity,
  yawFromMouse,
} from '@/engine/player/movement';

const still = { forward: false, back: false, left: false, right: false, strollFast: false };

describe('wishVelocity', () => {
  it('uses Aura speeds, including back and strafe multipliers', () => {
    const forward = wishVelocity({ ...still, forward: true });
    expect(forward.z).toBeCloseTo(1.35, 5);
    expect(Math.hypot(forward.x, forward.z)).toBeCloseTo(1.35, 5);

    const back = wishVelocity({ ...still, back: true });
    expect(Math.hypot(back.x, back.z)).toBeCloseTo(1.35 * 0.8, 5);

    const strafe = wishVelocity({ ...still, right: true });
    expect(Math.hypot(strafe.x, strafe.z)).toBeCloseTo(1.35 * 0.85, 5);

    const stroll = wishVelocity({ ...still, forward: true, strollFast: true });
    expect(Math.hypot(stroll.x, stroll.z)).toBeCloseTo(DEFAULT_MOVEMENT.strollFastSpeed, 5);
    expect(stroll.z).toBeLessThanOrEqual(2.2);
  });

  it('normalises diagonals so they are not faster than straight movement', () => {
    const diagonal = wishVelocity({ ...still, forward: true, right: true });
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1.35, 5);
    const strollDiagonal = wishVelocity({ ...still, forward: true, left: true, strollFast: true });
    expect(Math.hypot(strollDiagonal.x, strollDiagonal.z)).toBeCloseTo(2.2, 5);
  });
});

describe('viewToWorld', () => {
  it('facing +Z, D moves screen-right and mouse-right yaws screen-right', () => {
    const camera = new PerspectiveCamera();
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI;
    camera.updateMatrixWorld();
    const forward = new Vector3();
    const right = new Vector3();
    camera.getWorldDirection(forward);
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    expect(forward.z).toBeGreaterThan(0.99);
    expect(forward.x).toBeCloseTo(0, 5);
    expect(right.x).toBeLessThan(-0.99);

    const strafe = viewToWorld({ x: 1, z: 0 }, 0);
    expect(strafe.x).toBeCloseTo(right.x, 5);
    expect(strafe.z).toBeCloseTo(right.z, 5);

    const yaw = yawFromMouse(1, 0.2);
    expect(yaw).toBeLessThan(0);
    camera.rotation.y = Math.PI + yaw;
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    expect(forward.x).toBeLessThan(0);
    const moved = viewToWorld({ x: 0, z: 1 }, yaw);
    expect(moved.x).toBeCloseTo(forward.x, 5);
    expect(moved.z).toBeCloseTo(forward.z, 5);
  });
});

describe('damping and clamps', () => {
  it('reaches about full speed in 0.45s and glides to a stop', () => {
    let velocity = { x: 0, z: 0 };
    const target = { x: 0, z: 1.35 };
    for (let i = 0; i < 27; i += 1) velocity = dampVec2(velocity, target, 1 / 60);
    expect(velocity.z).toBeGreaterThan(1.35 * 0.9);
    expect(velocity.z).toBeLessThan(1.35);

    const stoppingFrom = { x: 0, z: 1.35 };
    let slowing = stoppingFrom;
    for (let i = 0; i < 12; i += 1) slowing = dampVec2(slowing, { x: 0, z: 0 }, 1 / 60);
    expect(slowing.z).toBeLessThan(1.35 * 0.6);
    expect(slowing.z).toBeGreaterThan(0.2);
  });

  it('clamps a stalled frame and pitch', () => {
    expect(clampFrameDt(3)).toBe(0.05);
    expect(clampFrameDt(0.016)).toBeCloseTo(0.016, 5);
    expect(clampFrameDt(Number.NaN)).toBe(0);
    expect(clampPitch(2)).toBeCloseTo((80 * Math.PI) / 180, 5);
    expect(clampPitch(-2)).toBeCloseTo((-80 * Math.PI) / 180, 5);
  });
});
