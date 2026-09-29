'use client';

import type { QualityTier } from '@/contracts/quality';
import type { FoliageAa } from '@/engine/quality/gpuMemory';
import { useFrameBudget } from '@/state/frameBudget';

/** Foliage mode chosen with the frame budget, so a world does not import state. */
export function useResolvedFoliage(tier: QualityTier, fallback: FoliageAa): FoliageAa {
  return useFrameBudget((state) =>
    state.presentation && state.presentation.tier === tier ? state.presentation.foliage : fallback,
  );
}
