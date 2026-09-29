import { describe, expect, it } from 'vitest';
import type { Collider } from '@/contracts/world';
import { slideMove, type Body } from '@/engine/player/collision';
import { seasideColliders, SPAWN } from '@/worlds/seaside-house/level';

const body: Body = { radius: 0.3, feetY: 0, height: 1.75 };

function wall(id: string, minX: number, minZ: number, maxX: number, maxZ: number, layers: Collider['layers']): Collider {
  return {
    id,
    box: { min: [minX, 0, minZ], max: [maxX, 3, maxZ] },
    layers,
  };
}

describe('slideMove', () => {
  const blocker = [wall('wall', 2, 0, 2.2, 10, ['movement', 'occluder', 'pinSurface'])];

  it('slides along a wall instead of stopping the free axis', () => {
    const next = slideMove(1, 1, 2, 1, body, blocker);
    expect(next.x).toBeCloseTo(2 - body.radius - 0.001, 3);
    expect(next.z).toBeCloseTo(2, 3);
  });

  it('stops head-on against a wall at the capsule radius', () => {
    const next = slideMove(1, 1, 3, 0, body, blocker);
    expect(next.x).toBeCloseTo(1.699, 3);
    expect(next.z).toBeCloseTo(1, 3);
  });

  it('does not tunnel a thin wall on a large step', () => {
    const thin = [wall('thin', 5, -2, 5.04, 2, ['movement'])];
    const next = slideMove(0, 0, 10, 0, body, thin);
    expect(next.x).toBeLessThan(5 - body.radius);
    expect(next.x).toBeGreaterThan(4);
  });

  it('ignores occluder-only and pin-surface-only boxes', () => {
    const decorations = [
      wall('occluder', 1, -1, 1.2, 1, ['occluder']),
      wall('pin', 1, -1, 1.2, 1, ['pinSurface']),
    ];
    const next = slideMove(0, 0, 3, 0, body, decorations);
    expect(next.x).toBeCloseTo(3, 5);
  });

  it('blocks movement-only glass the same way it blocks a wall', () => {
    const pane = [wall('glass', -1, 4, 1, 4.06, ['movement'])];
    const next = slideMove(0, 2, 0, 5, body, pane);
    expect(next.z).toBeLessThan(4);
    expect(next.z).toBeCloseTo(4 - body.radius - 0.001, 3);
  });

  it('lets a step pass through a gap between panels', () => {
    const panels = [
      wall('left', -4, 4, -1, 4.06, ['movement']),
      wall('right', 1, 4, 4, 4.06, ['movement']),
    ];
    const next = slideMove(0, 2, 0, 4, body, panels);
    expect(next.z).toBeCloseTo(6, 3);
  });

  it('does not block on a beam above the capsule', () => {
    const beam: Collider = {
      id: 'beam',
      box: { min: [-1, 2.4, -1], max: [1, 3.2, 1] },
      layers: ['movement', 'occluder'],
    };
    const next = slideMove(0, -3, 0, 5, body, [beam]);
    expect(next.z).toBeCloseTo(2, 5);
  });

  it('pushes a body that starts inside a collider back out', () => {
    const next = slideMove(2.05, 2, 0, 0, body, blocker);
    expect(next.x).toBeLessThanOrEqual(2 - body.radius);
  });
});

describe('seaside greybox collision', () => {
  it('walks the left side of the corridor through the open glass and stops at the balustrade', () => {
    let x = 0.7;
    let z = SPAWN.z;
    for (let i = 0; i < 400; i += 1) {
      const next = slideMove(x, z, 0, 0.08, body, seasideColliders);
      x = next.x;
      z = next.z;
    }
    expect(z).toBeGreaterThan(8.5);
    expect(z).toBeLessThan(9);
    expect(x).toBeCloseTo(0.7, 1);
  });

  it('walks straight from V2 through the centre opening to the balustrade', () => {
    let x = 0;
    let z = -3;
    let stalled = 0;
    for (let i = 0; i < 200; i += 1) {
      const next = slideMove(x, z, 0, 0.08, body, seasideColliders);
      if (next.z <= z + 0.001) {
        if (z < 8.5) stalled += 1;
        break;
      }
      x = next.x;
      z = next.z;
    }
    expect(stalled).toBe(0);
    expect(z).toBeGreaterThan(8.5);
    expect(z).toBeLessThan(9);
    expect(Math.abs(x)).toBeLessThan(0.05);
  });

  it('can cross in front of a closed panel that is still metres ahead', () => {
    let x = 0;
    let z = 1;
    for (let i = 0; i < 40; i += 1) {
      const next = slideMove(x, z, 0.15, 0.02, body, seasideColliders);
      x = next.x;
      z = next.z;
    }
    expect(x).toBeGreaterThan(4.5);
    expect(z).toBeLessThan(3);
  });

  it('slides along a closed panel edge without snagging', () => {
    let x = 1.65;
    let z = 3.4;
    let stalled = 0;
    let edgeX = x;
    for (let i = 0; i < 80; i += 1) {
      const next = slideMove(x, z, 0.05, 0.1, body, seasideColliders);
      if (next.z <= z + 0.001) stalled += 1;
      x = next.x;
      z = next.z;
      if (z <= 4.9) edgeX = Math.max(edgeX, x);
      if (z > 5) break;
    }
    expect(stalled).toBe(0);
    expect(z).toBeGreaterThan(5);
    expect(edgeX).toBeLessThanOrEqual(1.71);
  });

  it('keeps the fin, including the player radius, outside the centre band', () => {
    const fin = seasideColliders.find((collider) => collider.id === 'fin');
    expect(fin).toBeTruthy();
    if (!fin) return;
    const expandedMin = fin.box.min[0] - body.radius;
    const expandedMax = fin.box.max[0] + body.radius;
    expect(expandedMax <= -2 || expandedMin >= 2).toBe(true);
    const reveal = slideMove(0, -3, 0, 0, body, seasideColliders);
    expect(reveal).toEqual({ x: 0, z: -3 });
  });

  it('blocks the closed glass and the balustrade', () => {
    const intoGlass = slideMove(3, 3, 0, 4, body, seasideColliders);
    expect(intoGlass.z).toBeLessThan(4.5);

    const intoRail = slideMove(0, 8, 0, 3, body, seasideColliders);
    expect(intoRail.z).toBeLessThan(9);
    expect(intoRail.z).toBeGreaterThan(8.5);
  });
});
