import { describe, expect, it } from 'vitest';
import { curtainBillow, CURTAIN_BILLOW_MAX } from './curtainMath';
import { estimateTextureBytes } from './textures';
import { oceanGrid, oceanRadius, oceanUpNormalY } from './oceanMesh';
import { rockLayout } from './rocks';
import { cloudLayers, textureSizeForTier, waveCount } from './scale';
import { shadowCoversHouse, shadowFrustum } from './shadowFit';
import { CURTAIN_VERTEX_SNIPPET, createOceanMaterial } from './shaders';
import { gerstnerDisplacement } from './waves';

describe('seaside art scale', () => {
  it('uses fewer waves and a coarser ocean on LOW', () => {
    expect(waveCount('LOW')).toBe(2);
    expect(waveCount('HIGH')).toBe(5);
    expect(waveCount('LOW')).toBeLessThan(waveCount('MED'));
    expect(waveCount('MED')).toBeLessThan(waveCount('HIGH'));
    const low = oceanGrid('LOW');
    const high = oceanGrid('HIGH');
    expect(low.rings * low.segments).toBeLessThan(high.rings * high.segments);
    expect(cloudLayers('LOW')).toBe(1);
    expect(cloudLayers('MED')).toBe(2);
    expect(cloudLayers('HIGH')).toBe(2);
    expect(oceanRadius(140)).toBeGreaterThan(3500);
    expect(oceanRadius(140)).toBeLessThan(4200);
    expect(oceanUpNormalY()).toBeGreaterThan(0);
    expect(high.rings * high.segments * 2).toBeLessThan(80_000);
  });

  it('caps textures at 512 on LOW and 1k above', () => {
    expect(textureSizeForTier('LOW')).toBe(512);
    expect(textureSizeForTier('HIGH')).toBe(1024);
    expect(textureSizeForTier('ULTRA')).toBeLessThanOrEqual(2048);
    expect(estimateTextureBytes(512)).toBeLessThan(estimateTextureBytes(1024));
    expect(estimateTextureBytes(1024) / (1024 * 1024)).toBeLessThan(150);
  });

  it('fits the shadow camera around the house instead of ±5 m', () => {
    expect(shadowCoversHouse()).toBe(true);
    expect(shadowFrustum.right).toBe(10);
    expect(shadowFrustum.left).toBe(-10);
  });

  it('keeps curtain billow at or under 0.35 m and off the opening', () => {
    for (let y = 0; y <= 1; y += 0.1) {
      for (let time = 0; time < 8; time += 0.37) {
        const offset = curtainBillow(y, time, 0.5);
        expect(offset.z).toBeLessThanOrEqual(CURTAIN_BILLOW_MAX);
        expect(offset.z).toBeGreaterThanOrEqual(0);
        expect(Math.abs(offset.x)).toBeLessThanOrEqual(0.02);
      }
    }
    expect(curtainBillow(1, 0, 0).z).toBe(0);
    expect(CURTAIN_VERTEX_SNIPPET).toContain('min(0.35');
    expect(CURTAIN_VERTEX_SNIPPET).toContain('objectNormal');
  });

  it('moves the sea with Gerstner waves and stays a calm amplitude', () => {
    const rest = gerstnerDisplacement(0, 20, 0, 5);
    const later = gerstnerDisplacement(0, 20, 3, 5);
    expect(later.y).not.toBeCloseTo(rest.y, 2);
    let peak = 0;
    for (let t = 0; t < 12; t += 0.25) {
      peak = Math.max(peak, Math.abs(gerstnerDisplacement(4, 30, t, 5).y));
    }
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThan(0.7);
    const ocean = createOceanMaterial(3);
    expect(ocean.uniforms.uCount?.value).toBe(3);
    expect(ocean.fragmentShader).toContain('fres');
    expect(ocean.fragmentShader).toContain('glitter');
    expect(ocean.fragmentShader).toContain('foam');
    ocean.dispose();
  });

  it('keeps cove rocks in the water under the terrace', () => {
    expect(rockLayout()).toHaveLength(6);
    for (const rock of rockLayout()) {
      expect(rock.position[1]).toBeLessThan(-5);
      expect(Math.abs(rock.position[0])).toBeLessThan(30);
    }
  });
});
