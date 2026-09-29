import type { QualityTier } from '@/contracts/quality';

/** Art-pass tiers. LOW drops waves, mesh density, clouds, and texture size. */
export function waveCount(tier: QualityTier): number {
  if (tier === 'LOW') return 3;
  if (tier === 'MED') return 4;
  return 5;
}

/** Radial-ish plane segments. HIGH stays far under the triangle budget. */
export function oceanSegments(tier: QualityTier): [number, number] {
  if (tier === 'LOW') return [36, 22];
  if (tier === 'MED') return [56, 32];
  if (tier === 'HIGH') return [72, 42];
  return [88, 48];
}

export function cloudLayers(tier: QualityTier): number {
  if (tier === 'LOW') return 1;
  if (tier === 'MED') return 2;
  return 3;
}

export function curtainSegments(tier: QualityTier): [number, number] {
  if (tier === 'LOW') return [8, 12];
  if (tier === 'MED') return [14, 18];
  if (tier === 'HIGH') return [20, 28];
  return [24, 32];
}

/** User cap: 512 on LOW, 1k on HIGH. ULTRA stays at 1k so the GPU budget has room. */
export function textureSizeForTier(tier: QualityTier): number {
  return tier === 'LOW' ? 512 : 1024;
}

export function leafCount(tier: QualityTier): number {
  if (tier === 'LOW') return 5;
  if (tier === 'MED') return 8;
  return 11;
}

export function rockDetail(tier: QualityTier): number {
  return tier === 'LOW' || tier === 'MED' ? 0 : 1;
}
