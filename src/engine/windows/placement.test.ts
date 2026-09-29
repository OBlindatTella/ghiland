import { describe, expect, it } from 'vitest';
import type { Quat, Vec3 } from '@/contracts/math';
import { seasideHouse } from '@/worlds/seaside-house/definition';
import { sunDirection } from '@/worlds/seaside-house/sun';
import {
  autoPinPlacement,
  unionPlacementBounds,
  FLOAT_DISTANCE,
  GLASS_CLEARANCE,
  MIN_EYE_DISTANCE,
  physicalSize,
  PX_PER_METER,
  resolvePlacement,
  SURFACE_OFFSET,
  type PlacementBounds,
  type PlacementCollider,
  type PlacementQuery,
} from '@/engine/windows/placement';

const colliders = seasideHouse.collision.kind === 'boxes' ? seasideHouse.collision.colliders : [];
const anchors = seasideHouse.pinAnchors ?? [];

function place(origin: Vec3, direction: Vec3, heightPx = 560, occupied = new Set<string>()): ReturnType<typeof resolvePlacement> {
  const query: PlacementQuery = {
    ray: { origin, direction },
    colliders,
    anchors,
    occupied,
    heightPx,
  };
  return resolvePlacement(query);
}

function rotate(quat: Quat, vector: Vec3): Vec3 {
  const [qx, qy, qz, qw] = quat;
  const [vx, vy, vz] = vector;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

describe('resolvePlacement', () => {
  it('snaps to hero-sea when the glass hit is within 1.5 m and the eye is far enough', () => {
    const result = place([5, 1.62, 2.2], [0, 0, 1], 560);
    expect(result.valid).toBe(true);
    expect(result.placement).toBe('anchor');
    expect(result.anchorId).toBe('hero-sea');
    expect(result.position[0]).toBeCloseTo(5.1, 2);
    expect(result.position[1]).toBeCloseTo(1.45, 2);
    expect(result.position[2]).toBeCloseTo(3.9, 2);
    const normal = rotate(result.quaternion, [0, 0, 1]);
    expect(normal[0]).toBeCloseTo(-Math.sin((15 * Math.PI) / 180), 3);
    expect(normal[2]).toBeCloseTo(-Math.cos((15 * Math.PI) / 180), 3);
  });

  it('does not snap when the hit is farther than 1.5 m from the anchor', () => {
    const result = place([0, 1.62, 2.2], [0, 0, 1]);
    expect(result.anchorId).toBeUndefined();
    expect(result.placement).toBe('float');
    expect(result.position[2]).toBeCloseTo(2.2 + FLOAT_DISTANCE, 2);
  });

  it('falls through an occupied anchor', () => {
    const result = place([5, 1.62, 2.2], [0, 0, 1], 560, new Set(['hero-sea']));
    expect(result.placement).not.toBe('anchor');
    expect(result.taken).toBe(true);
    expect(result.anchorId).toBeUndefined();
  });

  it('uses the same result for the preview and the pin, and frees the anchor once it is open again', () => {
    const query: PlacementQuery = {
      ray: { origin: [5, 1.62, 2.2], direction: [0, 0, 1] },
      colliders,
      anchors,
      occupied: new Set<string>(),
      heightPx: 560,
    };
    const preview = resolvePlacement(query);
    const pin = resolvePlacement(query);
    expect(pin).toEqual(preview);
    expect(pin.anchorId).toBe('hero-sea');
    const held = resolvePlacement({ ...query, occupied: new Set(['hero-sea']) });
    expect(held.anchorId).toBeUndefined();
    const freed = resolvePlacement(query);
    expect(freed.anchorId).toBe('hero-sea');
  });

  it('floats on the player side of glass, at least 0.3 m clear', () => {
    const cases = [
      { eyeZ: 4.47 - 1.05, along: 1.05 - GLASS_CLEARANCE },
      { eyeZ: 4.47 - 1.5, along: 1.5 - GLASS_CLEARANCE },
      { eyeZ: 4.47 - 2.5, along: FLOAT_DISTANCE },
    ];
    for (const item of cases) {
      const result = place([3, 1.62, item.eyeZ], [0, 0, 1]);
      expect(result.placement).toBe('float');
      expect(result.valid).toBe(true);
      expect(result.position[2]).toBeCloseTo(item.eyeZ + item.along, 2);
      expect(4.47 - result.position[2]).toBeGreaterThanOrEqual(GLASS_CLEARANCE - 0.02);
      expect(result.position[2] - item.eyeZ).toBeGreaterThanOrEqual(MIN_EYE_DISTANCE - 0.001);
    }
  });

  it('refuses a glass float that would put the centre closer than 0.7 m (D-021)', () => {
    for (const distance of [0.5, 0.8, 0.95]) {
      const result = place([3, 1.62, 4.47 - distance], [0, 0, 1]);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('tooClose');
      expect(result.placement).toBe('float');
    }
    const nearAnchor = place([5, 1.62, 3.5], [0, 0, 1]);
    expect(nearAnchor.placement).toBe('anchor');
    expect(nearAnchor.valid).toBe(false);
    expect(nearAnchor.reason).toBe('tooClose');
  });

  it('stops at the glass instead of placing beyond it', () => {
    const result = place([3, 1.62, 3], [0, 0, 1]);
    expect(result.position[2]).toBeLessThan(4.47);
  });

  it('stands a window on a table, tilted about 10° back', () => {
    const table: PlacementCollider = {
      id: 'dining-table',
      box: { min: [-1, 0.7, 1], max: [1, 0.76, 2.2] },
      layers: ['movement', 'pinSurface'],
    };
    const result = resolvePlacement({
      ray: { origin: [0, 1.62, 0.8], direction: [0, -0.86, 0.7] },
      colliders: [table],
      anchors: [],
      occupied: new Set(),
      heightPx: 560,
    });
    expect(result.valid).toBe(true);
    expect(result.placement).toBe('surface');
    const half = 560 / PX_PER_METER / 2;
    const bottom = result.position[1] - half * Math.cos((10 * Math.PI) / 180);
    expect(bottom).toBeCloseTo(0.78, 2);
    const up = rotate(result.quaternion, [0, 1, 0]);
    expect(up[1]).toBeGreaterThan(0.95);
    expect(up[2]).toBeGreaterThan(0);
  });

  it('rejects a table pin that overhangs by more than 10% of its width', () => {
    const table: PlacementCollider = {
      id: 'coffee-table',
      box: { min: [0, 0.3, 0], max: [0.4, 0.38, 0.4] },
      layers: ['movement', 'pinSurface'],
    };
    const result = resolvePlacement({
      ray: { origin: [0.2, 1.4, -0.6], direction: [0, -0.8, 0.6] },
      colliders: [table],
      anchors: [],
      occupied: new Set(),
      heightPx: 560,
      widthPx: 440,
    });
    expect(result.placement).toBe('surface');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('outOfBounds');
  });

  it('keeps Notes at about 0.85 by 1.08 m', () => {
    expect(PX_PER_METER).toBe(520);
    const size = physicalSize(440, 560);
    expect(size.w).toBeCloseTo(0.846, 2);
    expect(size.h).toBeCloseTo(1.077, 2);
  });
});

const houseBounds: PlacementBounds = {
  min: [-7, 0, -9],
  max: [7, 0, 9],
  floorY: 0,
  ceilingY: null,
  railZ: 9,
};

describe('placement bounds', () => {
  it('keeps a float on the house side of the balustrade', () => {
    const result = resolvePlacement({
      ray: { origin: [0, 1.62, 8.7], direction: [0, Math.sin((5 * Math.PI) / 180), Math.cos((5 * Math.PI) / 180)] },
      colliders,
      anchors: [],
      occupied: new Set(),
      heightPx: 560,
      bounds: houseBounds,
    });
    expect(result.position[2]).toBeLessThanOrEqual(9 - 0.15);
    expect(result.valid).toBe(false);
  });

  it('keeps a side-wall pin 1 cm off the wall that was hit', () => {
    const east: PlacementCollider = {
      id: 'living-east',
      box: { min: [7, 0, -3.5], max: [7.2, 3.2, 4.5] },
      layers: ['movement', 'occluder', 'pinSurface'],
    };
    const result = resolvePlacement({
      ray: { origin: [4, 1.5, 0], direction: [1, 0, 0] },
      colliders: [east],
      anchors: [],
      occupied: new Set(),
      heightPx: 560,
      widthPx: 440,
      bounds: { min: [-7, 0, -9], max: [7, 3.2, 9], floorY: 0, ceilingY: 3.2, railZ: 9 },
    });
    expect(result.placement).toBe('surface');
    expect(result.valid).toBe(true);
    expect(result.position[0]).toBeCloseTo(6.99, 2);
  });

  it('sits a wall pin 1 cm off the surface and 2 cm clear of the floor', () => {
    expect(SURFACE_OFFSET).toBeCloseTo(0.01, 5);
    const result = resolvePlacement({
      ray: { origin: [0, 0.2, 1], direction: [0, -1, 0] },
      colliders,
      anchors: [],
      occupied: new Set(),
      heightPx: 560,
      bounds: { ...houseBounds, ceilingY: 3.2 },
    });
    if (result.placement !== 'anchor') {
      const half = 560 / PX_PER_METER / 2;
      expect(result.position[1] - half).toBeGreaterThanOrEqual(0.02 - 1e-4);
    }
  });
});

describe('auto-pin pose', () => {
  it('pulls a carried window back to the player side of the glass', () => {
    const eye: Vec3 = [3, 1.62, 3.2];
    const beyond: Vec3 = [3, 1.62, 6];
    const result = autoPinPlacement(eye, beyond, [0, 0, 0, 1], colliders);
    expect(result.valid).toBe(true);
    expect(result.placement).toBe('float');
    expect(result.position[2]).toBeLessThan(4.47);
    expect(4.47 - result.position[2]).toBeGreaterThanOrEqual(0.25);
    expect(result.position[2] - eye[2]).toBeGreaterThanOrEqual(MIN_EYE_DISTANCE - 1e-4);
  });

  it('is invalid when no float stays 0.7 m out, so the caller can dock it', () => {
    const eye: Vec3 = [3, 1.62, 4.2];
    const beyond: Vec3 = [3, 1.62, 6];
    const result = autoPinPlacement(eye, beyond, [0, 0, 0, 1], colliders, houseBounds);
    expect(result.valid).toBe(false);
  });

  it('lets a float aimed through the open panels land on the terrace', () => {
    const bounds = unionPlacementBounds(seasideHouse.zones, 0, 9);
    const result = resolvePlacement({
      ray: { origin: [0, 1.62, 3.2], direction: [0, 0, 1] },
      colliders,
      anchors: [],
      occupied: new Set(),
      heightPx: 560,
      bounds,
    });
    expect(result.valid).toBe(true);
    expect(result.position[2]).toBeGreaterThan(4.5);
    expect(result.position[2]).toBeLessThanOrEqual(8.85);
  });

  it('does not auto-pin over the sea', () => {
    const eye: Vec3 = [0, 1.62, 8.7];
    const beyond: Vec3 = [0, 1.8, 10.4];
    const result = autoPinPlacement(eye, beyond, [0, 0, 0, 1], colliders, houseBounds);
    expect(result.position[2]).toBeLessThanOrEqual(9 - 0.15);
  });
});

describe('D-027 sun', () => {
  it('points 22° from +Z toward −X at 12° elevation', () => {
    const sun = sunDirection(12, -22);
    expect(sun[0]).toBeCloseTo(-0.367, 2);
    expect(sun[1]).toBeCloseTo(0.208, 2);
    expect(sun[2]).toBeCloseTo(0.907, 2);
  });
});
