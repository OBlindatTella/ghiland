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
    // Pressing into the east opening corner must slide along the input, not snap back into the opening.
    let x = 1.69;
    let z = 4.0;
    let movedX = 0;
    for (let i = 0; i < 40; i += 1) {
      const next = slideMove(x, z, 0.05, 0.1, body, seasideColliders);
      expect(next.x).toBeGreaterThanOrEqual(x - 1e-4);
      movedX += Math.max(0, next.x - x);
      x = next.x;
      z = next.z;
    }
    expect(movedX).toBeGreaterThan(0.5);
    expect(x).toBeGreaterThan(2);
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
        if (onRail && Math.abs(dx) > 0.02) {
          expect(Math.abs(next.x - x), `frozen at ${x.toFixed(3)} heading ${heading.toFixed(2)}`).toBeGreaterThan(0.01);
        }
        x = next.x;
        z = next.z;
      }
    }
  });

  function walk(x: number, z: number, headingDeg: number, seconds: number): { x: number; z: number; xs: number[] } {
    const heading = (headingDeg * Math.PI) / 180;
    const speed = 1.35;
    const dt = 1 / 60;
    const xs: number[] = [];
    for (let t = 0; t < seconds; t += dt) {
      const next = slideMove(x, z, Math.sin(heading) * speed * dt, Math.cos(heading) * speed * dt, body, seasideColliders);
      x = next.x;
      z = next.z;
      if (Math.round(t * 10) !== Math.round((t - dt) * 10)) xs.push(x);
    }
    return { x, z, xs };
  }

  it('slides past the glass seam from (2.5, 4.0) at 60°', () => {
    const end = walk(2.5, 4.0, 60, 3);
    expect(Math.max(...end.xs, end.x)).toBeGreaterThan(3.7);
  });

  it('slides past the glass seam from (1.5, 3.5) at 45°', () => {
    const end = walk(1.5, 3.5, 45, 4);
    expect(Math.max(...end.xs, end.x)).toBeGreaterThan(3.7);
  });

  it('slides past the glass seam on the terrace face with a backward diagonal', () => {
    const towardWest = walk(5.2, 4.9, 240, 3);
    const towardEast = walk(2.5, 4.9, 120, 3);
    expect(Math.min(...towardWest.xs, towardWest.x)).toBeLessThan(3.7);
    expect(Math.max(...towardEast.xs, towardEast.x)).toBeGreaterThan(4.3);
  });

  it('slides past the back-wall seam from (3, -3.0) at 240°', () => {
    const end = walk(3, -3.0, 240, 3);
    expect(Math.min(...end.xs, end.x)).toBeLessThan(1.55);
  });

  it('does not freeze a near-corner strafe at x 1.7 for yaw 89.9° or 90.1°', () => {
    const almostIn = walk(1.0, 4.0, 89.9, 2);
    const almostOut = walk(1.0, 4.0, 90.1, 2);
    expect(Math.max(...almostIn.xs, almostIn.x)).toBeGreaterThan(1.7);
    expect(Math.max(...almostOut.xs, almostOut.x)).toBeGreaterThan(1.7);
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

  function trace(x: number, z: number, headingDeg: number, seconds: number) {
    const heading = (headingDeg * Math.PI) / 180;
    const step = 1.35 / 60;
    const dx = Math.sin(heading) * step;
    const dz = Math.cos(heading) * step;
    let frozen = 0;
    let maxJump = 0;
    for (let i = 0; i < seconds * 60; i += 1) {
      const next = slideMove(x, z, dx, dz, body, seasideColliders);
      const jump = Math.hypot(next.x - x, next.z - z);
      maxJump = Math.max(maxJump, jump);
      if (jump < 1e-4) frozen += 1;
      x = next.x;
      z = next.z;
    }
    return { x, z, frozen, maxJump, step: Math.hypot(dx, dz) };
  }

  it('does not snap backward at a free corner', () => {
    const step = 1.35 / 60;
    const cases = [
      { x: 4.95, z: 0.86, heading: 245 },
      { x: 1.95, z: 4.16, heading: 5 },
      { x: 1.05, z: -3.19, heading: 115 },
      { x: -2.5, z: 2.76, heading: 355 },
    ];
    for (const sample of cases) {
      const heading = (sample.heading * Math.PI) / 180;
      const dx = Math.sin(heading) * step;
      const dz = Math.cos(heading) * step;
      const next = slideMove(sample.x, sample.z, dx, dz, body, seasideColliders);
      const jump = Math.hypot(next.x - sample.x, next.z - sample.z);
      expect(jump, `${sample.x},${sample.z} @ ${sample.heading}`).toBeLessThanOrEqual(step + 1e-4);
      if (Math.abs(dx) > 1e-6) {
        expect(Math.sign(next.x - sample.x) === Math.sign(dx) || Math.abs(next.x - sample.x) < 1e-4).toBe(true);
      }
    }
  });

  it('sweeps every junction across 120 headings without a freeze or a jump', () => {
    const step = 1.35 / 60;
    const radius = body.radius;
    const movement = seasideColliders.filter((collider) => collider.layers.includes('movement'));
    const starts: { x: number; z: number }[] = [];
    for (const piece of movement) {
      for (const x of [piece.box.min[0], piece.box.max[0]]) {
        for (const z of [piece.box.min[2], piece.box.max[2]]) {
          for (const ox of [-1, 1]) {
            for (const oz of [-1, 1]) {
              starts.push({ x: x + ox * (radius + 0.04), z: z + oz * (radius + 0.04) });
            }
          }
        }
      }
    }
    const clearance = (x: number, z: number) => {
      let best = Infinity;
      for (const piece of movement) {
        const minX = piece.box.min[0] - radius;
        const maxX = piece.box.max[0] + radius;
        const minZ = piece.box.min[2] - radius;
        const maxZ = piece.box.max[2] + radius;
        const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
        const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
        best = Math.min(best, Math.hypot(dx, dz));
      }
      return best;
    };
    for (const start of starts) {
      if (clearance(start.x, start.z) < 0.01) continue;
      for (let h = 0; h < 120; h += 1) {
        const heading = (h / 120) * Math.PI * 2;
        const dx = Math.sin(heading) * step;
        const dz = Math.cos(heading) * step;
        let x = start.x;
        let z = start.z;
        for (let frame = 0; frame < 20; frame += 1) {
          const next = slideMove(x, z, dx, dz, body, seasideColliders);
          const jump = Math.hypot(next.x - x, next.z - z);
          expect(jump).toBeLessThanOrEqual(step + 1e-3);
          if (jump < 1e-4) expect(clearance(x, z)).toBeLessThanOrEqual(0.02);
          x = next.x;
          z = next.z;
        }
      }
    }
  });

  it('does not freeze at the dining-table and west-wall junction', () => {
    const north = trace(-6.68, 4.0, 160, 2);
    const south = trace(-6.7, 0.9, 15, 2);
    expect(north.frozen).toBeLessThan(10);
    expect(south.frozen).toBeLessThan(10);
    expect(north.x).toBeGreaterThan(-6.6);
    expect(south.x).toBeGreaterThan(-6.6);
    expect(north.maxJump).toBeLessThanOrEqual(north.step + 1e-4);
    expect(south.maxJump).toBeLessThanOrEqual(south.step + 1e-4);
  });

  it('reaches the glass from V2 on the 46° to 60.5° heading band', () => {
    // MOV-18: 40° and 43° run into the lounge cluster. 46°–60.5° clear it.
    for (const heading of [46, 50, 60.5]) {
      const walked = trace(0, -3, heading, 8);
      expect(walked.z, `${heading}`).toBeGreaterThan(2);
      expect(walked.maxJump).toBeLessThanOrEqual(walked.step + 1e-4);
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
