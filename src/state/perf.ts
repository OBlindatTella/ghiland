import { create } from 'zustand';

interface PerfStore {
  visible: boolean;
  toggle: () => void;
}

export const usePerfStore = create<PerfStore>((set) => ({
  visible: false,
  toggle: () => set((state) => ({ visible: !state.visible })),
}));
