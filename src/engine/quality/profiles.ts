import type { PerfBudget, QualityProfile, QualityTier } from '@/contracts/quality';

/** Atlas §6, with HIGH GPU memory at 384 MB (D-018). */
export const perfBudgets: Record<'LOW' | 'HIGH', PerfBudget> = {
  LOW: { maxDrawCalls: 80, maxTriangles: 250_000, maxGpuMemoryMB: 128, maxJsHeapMB: 300, targetFps: 30 },
  HIGH: { maxDrawCalls: 150, maxTriangles: 750_000, maxGpuMemoryMB: 384, maxJsHeapMB: 400, targetFps: 60 },
};

const shared = {
  drawDistance: 500,
  lodBias: 0,
  particleDensity: 1,
} as const;

export const qualityProfiles: Record<QualityTier, QualityProfile> = {
  LOW: {
    tier: 'LOW',
    dpr: [0.75, 1],
    shadows: 'off',
    shadowMapSize: 0,
    postprocessing: { enabled: true, bloom: false, smaa: true },
    multisampling: 0,
    foliage: 'alphaTest',
    maxTextureSize: 1024,
    water: 'low',
    ...shared,
    particleDensity: 0.3,
  },
  MED: {
    tier: 'MED',
    dpr: [1, 1.5],
    shadows: 'basic',
    shadowMapSize: 1024,
    postprocessing: { enabled: true, bloom: false, smaa: true },
    multisampling: 0,
    foliage: 'alphaTest',
    maxTextureSize: 2048,
    water: 'med',
    ...shared,
    particleDensity: 0.6,
  },
  HIGH: {
    tier: 'HIGH',
    dpr: [1, 2],
    shadows: 'soft',
    shadowMapSize: 2048,
    postprocessing: { enabled: true, bloom: true, smaa: false },
    multisampling: 4,
    foliage: 'alphaToCoverage',
    maxTextureSize: 2048,
    water: 'high',
    ...shared,
  },
  ULTRA: {
    tier: 'ULTRA',
    dpr: [1, 2],
    shadows: 'soft',
    shadowMapSize: 4096,
    postprocessing: { enabled: true, bloom: true, smaa: false },
    multisampling: 4,
    foliage: 'alphaToCoverage',
    maxTextureSize: 4096,
    water: 'high',
    ...shared,
  },
};
