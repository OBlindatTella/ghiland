import type { QualityTier } from '@/contracts/quality';

/** Art-pass tiers. LOW drops the waves shorter than its grid can sample. */
export function waveCount(tier: QualityTier): number {
  if (tier === 'LOW') return 2;
  if (tier === 'MED') return 4;
  return 5;
}

/**
 * Plane is 380 × 270 m. Segments keep at least two samples across the shortest
 * wave that tier still draws (24 m on LOW, 7.5 m on MED, 4.2 m on HIGH).
 */
export function oceanSegments(tier: QualityTier): [number, number] {
  if (tier === 'LOW') return [40, 28];
  if (tier === 'MED') return [104, 74];
  if (tier === 'HIGH') return [182, 130];
  return [200, 144];
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
