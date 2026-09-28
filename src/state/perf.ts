import { create } from 'zustand';
import type { QualityTier } from '@/contracts/quality';

export interface PerfMetrics {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  heapMb: number | null;
  longTasks: number;
}

export const emptyMetrics: PerfMetrics = {
  fps: 0,
  frameMs: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  heapMb: null,
  longTasks: 0,
};

interface PerfStore {
  autoTier: QualityTier;
  metrics: PerfMetrics;
  setAutoTier: (tier: QualityTier) => void;
  setMetrics: (metrics: PerfMetrics) => void;
}

export const usePerfStore = create<PerfStore>((set) => ({
  autoTier: 'HIGH',
  metrics: emptyMetrics,
  setAutoTier: (autoTier) => set({ autoTier }),
  setMetrics: (metrics) => set({ metrics }),
}));

/** Latest averaged sample. The AUTO clock reads this without subscribing. */
export const perfSample: PerfMetrics = { ...emptyMetrics };
