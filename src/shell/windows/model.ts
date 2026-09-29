import type { ScreenRect } from '@/contracts/math';
import type { WindowInstance, WindowMode, WindowState } from '@/contracts/window';
import { fitRect, placeRect, type Size } from '@/shell/windows/geometry';
import type { PinnedRecord } from '@/shell/windows/persistence';

export interface WindowBook {
  windows: Record<string, WindowInstance>;
  focusedId: string | null;
}

export const emptyWindowBook: WindowBook = { windows: {}, focusedId: null };

export interface OpenWindowInput {
  id: string;
  appId: string;
  title: string;
  defaultSize: Size;
  viewport: Size;
  now: number;
  savedRect?: ScreenRect;
}

function list(book: WindowBook): WindowInstance[] {
  return Object.values(book.windows).sort((a, b) => a.z - b.z);
}

const RECALL_MS = 10_000;
const recallArmed = new Map<string, number>();

function recallReady(id: string, now: number): boolean {
  const until = recallArmed.get(id);
  if (until === undefined || now > until) {
    recallArmed.delete(id);
    return false;
  }
  return true;
}

function raise(book: WindowBook, id: string): WindowBook {
  const windows = { ...book.windows };
  const top = list(book).reduce((max, item) => Math.max(max, item.z), 0) + 1;
  const current = windows[id];
  if (!current) return book;
  windows[id] = { ...current, z: top };
  return { windows, focusedId: id };
}

export function openWindow(
  book: WindowBook,
  input: OpenWindowInput,
): { book: WindowBook; created: boolean; effect: 'created' | 'focus' | 'pulse' | 'recall' } {
  const existing = Object.values(book.windows).find((item) => item.appId === input.appId);
  if (existing) {
    if (existing.mode.kind === 'worldPinned') {
      if (existing.state === 'minimized') {
        recallArmed.delete(existing.id);
        const restored: WindowInstance = { ...existing, state: 'normal' };
        return {
          book: raise({ windows: { ...book.windows, [existing.id]: restored }, focusedId: book.focusedId }, existing.id),
          created: false,
          effect: 'focus',
        };
      }
      if (recallReady(existing.id, input.now)) {
        recallArmed.delete(existing.id);
        const recalled: WindowInstance = {
          ...existing,
          state: 'normal',
          mode: { kind: 'overlay', rect: existing.lastScreenRect },
        };
        return {
          book: raise({ windows: { ...book.windows, [existing.id]: recalled }, focusedId: book.focusedId }, existing.id),
          created: false,
          effect: 'recall',
        };
      }
      recallArmed.set(existing.id, input.now + RECALL_MS);
      return { book, created: false, effect: 'pulse' };
    }
    recallArmed.delete(existing.id);
    const restored =
      existing.state === 'minimized' ? { ...book.windows, [existing.id]: { ...existing, state: 'normal' as const } } : book.windows;
    return { book: raise({ windows: restored, focusedId: book.focusedId }, existing.id), created: false, effect: 'focus' };
  }
  const previous = book.focusedId ? book.windows[book.focusedId]?.lastScreenRect ?? null : null;
  const safe = { minX: 24, minY: 24, maxX: input.viewport.w - 24, maxY: input.viewport.h - 88 };
  const rect = input.savedRect ? fitRect(input.savedRect, safe) : placeRect(input.defaultSize, input.viewport, previous);
  const z = list(book).reduce((max, item) => Math.max(max, item.z), 0) + 1;
  const window: WindowInstance = {
    id: input.id,
    appId: input.appId,
    title: input.title,
    mode: { kind: 'overlay', rect },
    lastScreenRect: rect,
    state: 'normal',
    z,
    owner: 'local',
    createdAt: input.now,
  };
  return {
    book: { windows: { ...book.windows, [window.id]: window }, focusedId: window.id },
    created: true,
    effect: 'created',
  };
}

export function closeWindow(book: WindowBook, id: string): WindowBook {
  recallArmed.delete(id);
  if (!book.windows[id]) return book;
  const windows = { ...book.windows };
  delete windows[id];
  const remaining = Object.values(windows)
    .filter((item) => item.state !== 'minimized')
    .sort((a, b) => b.z - a.z);
  return { windows, focusedId: book.focusedId === id ? remaining[0]?.id ?? null : book.focusedId };
}

export function focusWindow(book: WindowBook, id: string): WindowBook {
  if (!book.windows[id]) return book;
  return raise(book, id);
}

export function setWindowState(book: WindowBook, id: string, state: WindowState): WindowBook {
  const current = book.windows[id];
  if (!current) return book;
  const next = { ...book.windows, [id]: { ...current, state } };
  if (state === 'minimized') {
    const others = Object.values(next)
      .filter((item) => item.id !== id && item.state !== 'minimized')
      .sort((a, b) => b.z - a.z);
    return { windows: next, focusedId: book.focusedId === id ? others[0]?.id ?? null : book.focusedId };
  }
  return raise({ windows: next, focusedId: book.focusedId }, id);
}

export function setWindowRect(book: WindowBook, id: string, rect: ScreenRect): WindowBook {
  const current = book.windows[id];
  if (!current || current.mode.kind !== 'overlay') return book;
  return {
    ...book,
    windows: {
      ...book.windows,
      [id]: { ...current, lastScreenRect: rect, mode: { kind: 'overlay', rect } },
    },
  };
}

export function setWindowMode(book: WindowBook, id: string, mode: WindowMode): WindowBook {
  recallArmed.delete(id);
  const current = book.windows[id];
  if (!current) return book;
  return { ...book, windows: { ...book.windows, [id]: { ...current, mode, state: 'normal' } } };
}

export function restorePinned(
  book: WindowBook,
  records: readonly PinnedRecord[],
  rects: Record<string, ScreenRect> = {},
): WindowBook {
  const windows = { ...book.windows };
  for (const record of records) {
    if (Object.values(windows).some((item) => item.appId === record.appId)) continue;
    windows[record.id] = {
      id: record.id,
      appId: record.appId,
      title: record.title,
      mode: {
        kind: 'worldPinned',
        worldId: record.worldId,
        position: record.position,
        quaternion: record.quaternion,
        pxPerMeter: 520,
        placement: record.placement,
        anchorId: record.anchorId,
      },
      lastScreenRect: rects[record.appId] ?? { x: 48, y: 48, w: record.w, h: record.h },
      state: 'normal',
      z: 1,
      owner: 'local',
      createdAt: 0,
    };
  }
  return { windows, focusedId: book.focusedId };
}

export function setWindowTitle(book: WindowBook, id: string, title: string): WindowBook {
  const current = book.windows[id];
  if (!current) return book;
  return { ...book, windows: { ...book.windows, [id]: { ...current, title } } };
}

/** Persistence shape for step 7. Not written to storage yet. */
export interface WindowsPersist {
  windows: WindowInstance[];
}

export const windowsVersion = 1;

export function migrateWindows(raw: unknown, fromVersion: number): WindowsPersist {
  if (fromVersion > windowsVersion || !raw || typeof raw !== 'object') return { windows: [] };
  const windows = (raw as { windows?: unknown }).windows;
  if (!Array.isArray(windows)) return { windows: [] };
  return { windows: windows.filter((item) => item && typeof item === 'object') as WindowInstance[] };
}

export function bookFromPersist(data: WindowsPersist): WindowBook {
  const windows: Record<string, WindowInstance> = {};
  for (const item of data.windows) {
    if (!item.id || !item.appId) continue;
    const mode = item.mode?.kind === 'detached' ? { kind: 'overlay' as const, rect: item.lastScreenRect } : item.mode;
    windows[item.id] = { ...item, mode, state: item.state === 'minimized' ? 'minimized' : 'normal', owner: 'local' };
  }
  return { windows, focusedId: null };
}
