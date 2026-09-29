import { describe, expect, it } from 'vitest';
import type { Collider } from '@/contracts/world';
import { slideMove, type Body } from '@/engine/player/collision';
import { furnitureColliders } from '@/worlds/seaside-house/furniture';
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
    // Start within the capsule radius of the east opening corner (expanded x 1.7, z 4.17).
    let x = 1.69;
    let z = 4.0;
    let stalled = 0;
    let edgeX = x;
    for (let i = 0; i < 40; i += 1) {
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

  it('walks 70° from the room centre for 5 s and reaches the hero side of the room', () => {
    const heading = (70 * Math.PI) / 180;
    const speed = 1.35;
    const dt = 0.05;
    let x = 0;
    let z = 0;
    for (let t = 0; t < 5; t += dt) {
      const next = slideMove(x, z, Math.sin(heading) * speed * dt, Math.cos(heading) * speed * dt, body, seasideColliders);
      x = next.x;
      z = next.z;
    }
    expect(x).toBeGreaterThan(6);
    expect(z).toBeGreaterThan(2);
    expect(Math.abs(x - 1.699)).toBeGreaterThan(1);
    expect(Math.hypot(x - 5.1, z - 3.9)).toBeLessThan(2.5);
  });

  it('walks on the bearing to hero-sea and stops at the glass in front of it', () => {
    const bearing = Math.atan2(5.1, 3.9);
    const speed = 1.35;
    const dt = 0.05;
    let x = 0;
    let z = 0;
    for (let t = 0; t < 6; t += dt) {
      const next = slideMove(x, z, Math.sin(bearing) * speed * dt, Math.cos(bearing) * speed * dt, body, seasideColliders);
      x = next.x;
      z = next.z;
    }
    expect(Math.hypot(x - 5.1, z - 3.9)).toBeLessThan(1.2);
    expect(z).toBeLessThan(4.5);
  });

  it('does not rail diagonal walks on panel or corridor edges', () => {
    const rails = [1.7, -1.7, 3.7, -3.7, 5.7, -5.7, 0.8, -0.8];
    let seed = 0x5eed;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let n = 0; n < 48; n += 1) {
      let x = -5.5 + rand() * 11;
      let z = -2.5 + rand() * 5.5;
      const heading = rand() * Math.PI * 2;
      const step = 0.12;
      const dx = Math.sin(heading) * step;
      const dz = Math.cos(heading) * step;
      if (Math.abs(dz) < 0.02) continue;
      for (let i = 0; i < 30; i += 1) {
        const next = slideMove(x, z, dx, dz, body, seasideColliders);
        const onRail = rails.some((rail) => Math.abs(x - (rail > 0 ? rail - 0.001 : rail + 0.001)) < 0.02 || Math.abs(next.x - (rail > 0 ? rail - 0.001 : rail + 0.001)) < 0.02);
        const nearEdge = seasideColliders.some((collider) => {
          if (!collider.layers.includes('movement')) return false;
          const minX = collider.box.min[0] - body.radius;
          const maxX = collider.box.max[0] + body.radius;
          const minZ = collider.box.min[2] - body.radius;
          const maxZ = collider.box.max[2] + body.radius;
          const corners = [
            [minX, minZ],
            [maxX, minZ],
            [minX, maxZ],
            [maxX, maxZ],
          ];
          return corners.some(([cx, cz]) => {
            const lx = x - (cx ?? 0);
            const lz = z - (cz ?? 0);
            return lx * lx + lz * lz <= (body.radius + step) * (body.radius + step);
          });
        });
        if (onRail && !nearEdge && Math.abs(dx) > 0.02) {
          expect(Math.abs(next.x - x)).toBeGreaterThan(0.01);
        }
        x = next.x;
        z = next.z;
      }
    }
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

  it('keeps every furniture collider outside the centre band', () => {
    for (const piece of furnitureColliders) {
      const minX = piece.box.min[0] - body.radius;
      const maxX = piece.box.max[0] + body.radius;
      expect(minX < 2 && maxX > -2, piece.id).toBe(false);
      expect(piece.layers.includes('occluder')).toBe(false);
    }
    const fig = furnitureColliders.find((piece) => piece.id === 'fig-planter');
    expect(fig).toBeTruthy();
    if (!fig) return;
    expect((fig.box.min[0] + fig.box.max[0]) / 2).toBeCloseTo(-2.9, 5);
    expect((fig.box.min[2] + fig.box.max[2]) / 2).toBeCloseTo(-2.6, 5);
    expect(fig.box.max[0] + body.radius).toBeLessThanOrEqual(-2);
  });

  it('stops a diagonal step on each furniture collider', () => {
    for (const piece of furnitureColliders) {
      const cx = (piece.box.min[0] + piece.box.max[0]) / 2;
      const z0 = piece.box.min[2] - body.radius - 0.08;
      const next = slideMove(cx, z0, 0.12, 0.35, body, [piece]);
      expect(next.z).toBeLessThan(piece.box.min[2]);
      const inside =
        next.x > piece.box.min[0] &&
        next.x < piece.box.max[0] &&
        next.z > piece.box.min[2] &&
        next.z < piece.box.max[2];
      expect(inside).toBe(false);
    }
  });

  it('blocks the closed glass and the balustrade', () => {
    const intoGlass = slideMove(3, 3, 0, 4, body, seasideColliders);
    expect(intoGlass.z).toBeLessThan(4.5);

    const intoRail = slideMove(0, 8, 0, 3, body, seasideColliders);
    expect(intoRail.z).toBeLessThan(9);
    expect(intoRail.z).toBeGreaterThan(8.5);
  });
});
