import { create } from 'zustand';
import type { ScreenRect } from '@/contracts/math';
import type { WindowInstance } from '@/contracts/window';
import {
  closeWindow,
  emptyWindowBook,
  focusWindow,
  openWindow,
  setWindowRect,
  setWindowState,
  setWindowTitle,
  type OpenWindowInput,
} from '@/shell/windows/model';

interface WindowsStore {
  windows: Record<string, WindowInstance>;
  focusedId: string | null;
  open: (input: OpenWindowInput) => { id: string; created: boolean };
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  setRect: (id: string, rect: ScreenRect) => void;
  setTitle: (id: string, title: string) => void;
}

export const useWindows = create<WindowsStore>((set, get) => ({
  ...emptyWindowBook,
  open: (input) => {
    const result = openWindow(
      { windows: get().windows, focusedId: get().focusedId },
      input,
    );
    set(result.book);
    return { id: result.created ? input.id : result.book.focusedId ?? input.id, created: result.created };
  },
  close: (id) => set(closeWindow({ windows: get().windows, focusedId: get().focusedId }, id)),
  focus: (id) => set(focusWindow({ windows: get().windows, focusedId: get().focusedId }, id)),
  minimize: (id) => set(setWindowState({ windows: get().windows, focusedId: get().focusedId }, id, 'minimized')),
  restore: (id) => set(setWindowState({ windows: get().windows, focusedId: get().focusedId }, id, 'normal')),
  setRect: (id, rect) => set(setWindowRect({ windows: get().windows, focusedId: get().focusedId }, id, rect)),
  setTitle: (id, title) => set(setWindowTitle({ windows: get().windows, focusedId: get().focusedId }, id, title)),
}));
