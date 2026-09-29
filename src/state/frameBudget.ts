import { create } from 'zustand';
import type { Presentation } from '@/engine/quality/gpuMemory';

interface FrameBudgetStore {
  presentation: Presentation | null;
  /** Drawing-buffer ratio. Null until the budget resolver has run. */
  pixelRatio: number | null;
  setPresentation: (presentation: Presentation) => void;
}

export const useFrameBudget = create<FrameBudgetStore>((set) => ({
  presentation: null,
  pixelRatio: null,
  setPresentation: (presentation) =>
    set({
      presentation,
      pixelRatio: presentation.dpr * presentation.renderScale,
    }),
}));
