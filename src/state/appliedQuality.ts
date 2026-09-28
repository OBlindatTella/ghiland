import { create } from 'zustand';
import type { QualityTier } from '@/contracts/quality';

interface AppliedQualityStore {
  tier: QualityTier;
  dim: boolean;
  setTier: (tier: QualityTier) => void;
  setDim: (dim: boolean) => void;
}

export const useAppliedQuality = create<AppliedQualityStore>((set) => ({
  tier: 'HIGH',
  dim: false,
  setTier: (tier) => set({ tier }),
  setDim: (dim) => set({ dim }),
}));
