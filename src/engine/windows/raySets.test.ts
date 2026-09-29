import { describe, expect, it } from 'vitest';
import { blocksCrosshair, blocksOcclusion, blocksPlacement } from '@/engine/windows/raySets';
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
});