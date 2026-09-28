export type QualityTier = 'LOW' | 'MED' | 'HIGH' | 'ULTRA';
export type QualitySetting = QualityTier | 'AUTO';

export interface QualityProfile {
  tier: QualityTier;
  dpr: [min: number, max: number];
  shadows: 'off' | 'basic' | 'soft';
  shadowMapSize: 0 | 1024 | 2048 | 4096;
  postprocessing: { enabled: boolean; bloom: boolean; smaa: boolean };
  multisampling: 0 | 4;
  foliage: 'alphaTest' | 'alphaToCoverage';
  maxTextureSize: 1024 | 2048 | 4096;
  drawDistance: number;
  lodBias: number;
  particleDensity: number;
  water: 'low' | 'med' | 'high';
}

/** Atlas §6 budget table. Worlds may override any field. */
export interface PerfBudget {
  maxDrawCalls: number;
  maxTriangles: number;
  maxGpuMemoryMB: number;
  maxJsHeapMB: number;
  targetFps: number;
}
