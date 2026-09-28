import { create } from 'zustand';
import type { WorldPhase } from '@/contracts/world';

export type RoutePhase = 'landing' | 'loading' | 'inWorld';
export type LoadStall = 'ok' | 'slow' | 'stuck';

interface SessionStore {
  phase: RoutePhase;
  worldId: string | null;
  worldPhase: WorldPhase;
  loadProgress: number;
  stall: LoadStall;
  /** Set by the 30s "Try Low quality" action. Settings apply it in step 3. */
  forceLow: boolean;
  beginSeaside: () => void;
  setProgress: (value: number) => void;
  markActive: () => void;
  setStall: (stall: LoadStall) => void;
  requestLow: () => void;
}

export const useSession = create<SessionStore>((set, get) => ({
  phase: 'landing',
  worldId: null,
  worldPhase: 'idle',
  loadProgress: 0,
  stall: 'ok',
  forceLow: false,
  beginSeaside: () => {
    if (get().worldId === 'seaside-house') return;
    set({
      phase: 'loading',
      worldId: 'seaside-house',
      worldPhase: 'loading',
      loadProgress: 0.08,
      stall: 'ok',
    });
  },
  setProgress: (value) => {
    const current = get();
    if (current.worldPhase === 'active') return;
    const next = Math.max(current.loadProgress, Math.min(1, value));
    set({ loadProgress: next, worldPhase: next >= 1 ? 'ready' : 'loading' });
  },
  markActive: () => set({ phase: 'inWorld', worldPhase: 'active', loadProgress: 1 }),
  setStall: (stall) => set({ stall }),
  requestLow: () => set({ forceLow: true, stall: 'ok' }),
}));
