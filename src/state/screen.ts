import { create } from 'zustand';
import { popScreenLayer, pushScreenLayer, type ScreenLayer } from '@/shell/screen/layers';

interface ScreenStore {
  stack: ScreenLayer[];
  push: (layer: ScreenLayer) => void;
  pop: () => { release: boolean; closed: ScreenLayer | null };
  remove: (layer: ScreenLayer) => void;
  clear: () => void;
}

export const useScreenStore = create<ScreenStore>((set, get) => ({
  stack: [],
  push: (layer) => set({ stack: pushScreenLayer(get().stack, layer) }),
  pop: () => {
    const result = popScreenLayer(get().stack);
    set({ stack: result.stack });
    return { release: result.release, closed: result.closed };
  },
  remove: (layer) => set({ stack: get().stack.filter((item) => item !== layer) }),
  clear: () => set({ stack: [] }),
}));
