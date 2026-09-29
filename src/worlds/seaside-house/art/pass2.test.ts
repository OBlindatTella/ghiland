import { describe, expect, it } from 'vitest';
import { rightArmStaysOffGlitter } from './cove';
import { buildFarRidgeGeometry, buildHeadlandGeometry, headlandCliffs, headlandResolution, LIGHTHOUSE_AT } from './headland';
import { SEASIDE_FOG_COLOR, SEASIDE_FOG_DENSITY, SEASIDE_SUN, SEASIDE_SUN_ELEVATION } from './horizon';
import { createOceanMaterial, createSkyMaterial } from './shaders';

function triangles(geometry: { getIndex: () => { count: number } | null }): number {
  return (geometry.getIndex()?.count ?? 0) / 3;
}

describe('art pass 2 horizon and land', () => {
  it('puts the sun at 12.5° with the D-040 vector', () => {
    expect(SEASIDE_SUN_ELEVATION).toBe(12.5);
    expect(SEASIDE_SUN[0]).toBeCloseTo(-0.366, 2);
    expect(SEASIDE_SUN[1]).toBeCloseTo(0.216, 2);
    expect(SEASIDE_SUN[2]).toBeCloseTo(0.905, 2);
    expect(SEASIDE_FOG_COLOR).toBe('#D6D4CC');
    expect(SEASIDE_FOG_DENSITY).toBe(0.00048);
  });

  it('shares one sky function between the dome and the sea', () => {
    const sky = createSkyMaterial(2);
    const ocean = createOceanMaterial(5);
    expect(sky.fragmentShader).toContain('ghSky');
    expect(ocean.fragmentShader).toContain('ghSky');
    expect(ocean.fragmentShader).toContain('ghFogCol');
    expect(ocean.fragmentShader).toContain('0.00048');
    expect(sky.fragmentShader).toContain('0.999986');
    expect(ocean.fragmentShader).not.toContain('0.000121');
    sky.dispose();
    ocean.dispose();
  });

  it('builds a sunk headland, a far ridge, and a lighthouse on the tip', () => {
    const high = headlandResolution('HIGH');
    const low = headlandResolution('LOW');
    const ridge = buildHeadlandGeometry(high.stations, high.steps);
    const small = buildHeadlandGeometry(low.stations, low.steps);
    const far = buildFarRidgeGeometry(64, 8);
    expect(triangles(ridge)).toBeGreaterThan(4000);
    expect(triangles(ridge)).toBeLessThan(8000);
    expect(triangles(small)).toBeLessThan(2500);
    expect(triangles(far)).toBeGreaterThan(800);
    expect(triangles(far)).toBeLessThan(1400);
    expect(LIGHTHOUSE_AT).toEqual([538, 23, 1125]);
    expect(headlandCliffs()).toHaveLength(3);
    ridge.dispose();
    small.dispose();
    far.dispose();
  });

  it('keeps the mirrored cove arm off the glitter lane', () => {
    expect(rightArmStaysOffGlitter()).toBe(true);
  });
});
