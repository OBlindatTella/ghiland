import { describe, expect, it } from 'vitest';
import { blocksCrosshair, blocksOcclusion, blocksPlacement, raySetMembers } from '@/engine/windows/raySets';
import { levelBoxes, seasideColliders } from '@/worlds/seaside-house/level';

describe('ray blocker sets', () => {
  it('keeps soffit and curtains out of every ray', () => {
    for (const id of ['soffit', 'curtain-left', 'curtain-right']) {
      const box = levelBoxes.find((item) => item.id === id);
      expect(box?.layers).toEqual([]);
      expect(seasideColliders.some((item) => item.id === id)).toBe(false);
    }
  });

  it('uses three filters: placement, occlusion, and crosshair', () => {
    const glass = seasideColliders.find((item) => item.id === 'glass-closed-east');
    const floor = seasideColliders.find((item) => item.id === 'living-floor');
    const wall = seasideColliders.find((item) => item.id === 'living-east');
    expect(glass && blocksPlacement(glass.layers)).toBe(true);
    expect(glass && blocksOcclusion(glass.layers)).toBe(false);
    expect(glass && blocksCrosshair(glass.layers)).toBe(false);
    expect(floor && blocksPlacement(floor.layers)).toBe(true);
    expect(floor && blocksCrosshair(floor.layers)).toBe(false);
    expect(wall && blocksPlacement(wall.layers)).toBe(true);
    expect(wall && blocksOcclusion(wall.layers)).toBe(true);
    expect(wall && blocksCrosshair(wall.layers)).toBe(true);
  });

  it('lists each collider in the ray set that accepts its layers', () => {
    const sets = raySetMembers(seasideColliders);
    const placement = new Set(sets.placement.map((item) => item.id));
    const occlusion = new Set(sets.occlusion.map((item) => item.id));
    expect(placement.has('glass-closed-east')).toBe(true);
    expect(placement.has('living-floor')).toBe(true);
    expect(occlusion.has('glass-closed-east')).toBe(false);
    expect(occlusion.has('living-east')).toBe(true);
    expect(sets.crosshair.map((item) => item.id)).toEqual(sets.occlusion.map((item) => item.id));
    expect(sets.placement.every((item) => item.layers.length > 0)).toBe(true);
  });
});