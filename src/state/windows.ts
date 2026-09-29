import { create } from 'zustand';
import type { ScreenRect } from '@/contracts/math';
import type { WindowInstance } from '@/contracts/window';
import type { WindowMode } from '@/contracts/window';
import type { PinnedRecord } from '@/shell/windows/persistence';
import { pulseWindow } from '@/shell/windows/pulse';
import {
  closeWindow,
  emptyWindowBook,
  focusWindow,
  openWindow,
  restorePinned,
  setWindowMode,
  setWindowRect,
  setWindowState,
  setWindowTitle,
  type OpenWindowInput,
} from '@/shell/windows/model';

interface WindowsStore {
  windows: Record<string, WindowInstance>;
  focusedId: string | null;
  closingIds: string[];
  open: (input: OpenWindowInput) => { id: string; created: boolean };
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  setRect: (id: string, rect: ScreenRect) => void;
  setTitle: (id: string, title: string) => void;
  setMode: (id: string, mode: WindowMode) => void;
  restoreWorld: (records: readonly PinnedRecord[], rects?: Record<string, ScreenRect>) => void;
}

export const useWindows = create<WindowsStore>((set, get) => ({
  ...emptyWindowBook,
  closingIds: [],
  open: (input) => {
    const result = openWindow(
      { windows: get().windows, focusedId: get().focusedId },
      input,
    );
    set(result.book);
    const id = result.created ? input.id : Object.values(result.book.windows).find((item) => item.appId === input.appId)?.id ?? input.id;
    if (result.effect === 'pulse') pulseWindow(id);
    return { id, created: result.created };
  },
  close: (id) => {
    if (!get().windows[id] || get().closingIds.includes(id)) return;
    set({ closingIds: [...get().closingIds, id] });
    window.setTimeout(() => {
      const book = closeWindow({ windows: get().windows, focusedId: get().focusedId }, id);
      set({ ...book, closingIds: get().closingIds.filter((item) => item !== id) });
    }, 120);
  },
  focus: (id) => set(focusWindow({ windows: get().windows, focusedId: get().focusedId }, id)),
  minimize: (id) => set(setWindowState({ windows: get().windows, focusedId: get().focusedId }, id, 'minimized')),
  restore: (id) => set(setWindowState({ windows: get().windows, focusedId: get().focusedId }, id, 'normal')),
  setRect: (id, rect) => set(setWindowRect({ windows: get().windows, focusedId: get().focusedId }, id, rect)),
  setTitle: (id, title) => set(setWindowTitle({ windows: get().windows, focusedId: get().focusedId }, id, title)),
  setMode: (id, mode) => set(setWindowMode({ windows: get().windows, focusedId: get().focusedId }, id, mode)),
  restoreWorld: (records, rects) =>
    set(restorePinned({ windows: get().windows, focusedId: get().focusedId }, records, rects)),
}));
