import { create } from 'zustand';

interface GlStore {
  lost: boolean;
  lostAt: number | null;
  lose: () => void;
  restore: () => void;
}

export const useGlStore = create<GlStore>((set) => ({
  lost: false,
  lostAt: null,
  lose: () => set({ lost: true, lostAt: performance.now() }),
  restore: () => set({ lost: false, lostAt: null }),
}));
