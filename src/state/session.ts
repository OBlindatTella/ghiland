import { create } from 'zustand';

export type RoutePhase = 'landing' | 'inWorld';

interface SessionStore {
  phase: RoutePhase;
  worldId: string | null;
  enterSeaside: () => void;
}

export const useSession = create<SessionStore>((set) => ({
  phase: 'landing',
  worldId: null,
  enterSeaside: () => set({ phase: 'inWorld', worldId: 'seaside-house' }),
}));
