import { describe, expect, it } from 'vitest';
import { closeWindow, emptyWindowBook, migrateWindows, openWindow, restorePinned, setWindowMode, setWindowRect, setWindowState } from '@/shell/windows/model';
import { fileFromWindows } from '@/shell/windows/persistence';

const viewport = { w: 1280, h: 800 };
const size = { w: 440, h: 560 };

describe('window book', () => {
  it('opens one window per app, raises it, and cascades a second app', () => {
    const first = openWindow(emptyWindowBook, {
      id: 'a',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 1,
    });
    expect(first.created).toBe(true);
    expect(first.book.focusedId).toBe('a');
    const again = openWindow(first.book, {
      id: 'ignored',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 2,
    });
    expect(again.created).toBe(false);
    expect(Object.keys(again.book.windows)).toEqual(['a']);
    const second = openWindow(again.book, {
      id: 'b',
      appId: 'chat',
      title: 'Chat',
      defaultSize: { w: 440, h: 620 },
      viewport,
      now: 3,
    });
    expect(second.book.focusedId).toBe('b');
    expect(second.book.windows.b.z).toBeGreaterThan(second.book.windows.a.z);
    const rectA = second.book.windows.a.lastScreenRect;
    const rectB = second.book.windows.b.lastScreenRect;
    expect(rectB.x).toBe(rectA.x + 32);
    expect(rectB.y).toBeGreaterThanOrEqual(24);
    expect(rectB.y + rectB.h).toBeLessThanOrEqual(800 - 88);
  });

  it('minimizes to the tray and restores the same rect', () => {
    const opened = openWindow(emptyWindowBook, {
      id: 'a',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 1,
    });
    const moved = setWindowRect(opened.book, 'a', { x: 80, y: 90, w: 500, h: 400 });
    const hidden = setWindowState(moved, 'a', 'minimized');
    expect(hidden.windows.a.state).toBe('minimized');
    expect(hidden.focusedId).toBeNull();
    const shown = setWindowState(hidden, 'a', 'normal');
    expect(shown.windows.a.lastScreenRect).toEqual({ x: 80, y: 90, w: 500, h: 400 });
    expect(shown.focusedId).toBe('a');
  });

  it('closes and is ready to migrate without persisting carried state', () => {
    const opened = openWindow(emptyWindowBook, {
      id: 'a',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 1,
    });
    expect(closeWindow(opened.book, 'a').windows).toEqual({});
    const second = openWindow(opened.book, {
      id: 'b',
      appId: 'chat',
      title: 'Chat',
      defaultSize: size,
      viewport,
      now: 2,
    });
    const hidden = setWindowState(second.book, 'a', 'minimized');
    const closed = closeWindow(hidden, 'b');
    expect(closed.focusedId).toBeNull();
    const migrated = migrateWindows({ windows: [opened.book.windows.a] }, 1);
    expect(migrated.windows).toHaveLength(1);
    expect(migrateWindows({ windows: 'nope' }, 1)).toEqual({ windows: [] });
  });

  it('pulses a pinned app, then recalls it on the next open', () => {
    const opened = openWindow(emptyWindowBook, {
      id: 'a',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 1,
    });
    const pinned = setWindowMode(opened.book, 'a', {
      kind: 'worldPinned',
      worldId: 'seaside-house',
      position: [5.1, 1.45, 3.9],
      quaternion: [0, 0, 0, 1],
      pxPerMeter: 520,
      placement: 'anchor',
      anchorId: 'hero-sea',
    });
    const pulse = openWindow(pinned, {
      id: 'ignored',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 2,
    });
    expect(pulse.effect).toBe('pulse');
    expect(pulse.book.windows.a.mode.kind).toBe('worldPinned');
    const recall = openWindow(pulse.book, {
      id: 'ignored',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 3,
    });
    expect(recall.effect).toBe('recall');
    expect(recall.book.windows.a.mode.kind).toBe('overlay');
    const again = openWindow(recall.book, {
      id: 'ignored',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 4,
    });
    expect(again.effect).toBe('focus');
    expect(Object.keys(again.book.windows)).toEqual(['a']);
  });

  it('keeps a closed app rect and restores a pinned window on its saved rect', () => {
    const opened = openWindow(emptyWindowBook, {
      id: 'a',
      appId: 'notes',
      title: 'Notes',
      defaultSize: size,
      viewport,
      now: 1,
      savedRect: { x: 120, y: 80, w: 440, h: 560 },
    });
    const moved = setWindowRect(opened.book, 'a', { x: 120, y: 80, w: 440, h: 560 });
    const previous = fileFromWindows(Object.values(moved.windows));
    const merged = fileFromWindows([], previous);
    expect(merged.rects.notes).toEqual({ x: 120, y: 80, w: 440, h: 560 });
    const restored = restorePinned(
      emptyWindowBook,
      [
        {
          id: 'a',
          appId: 'notes',
          title: 'Notes',
          worldId: 'seaside-house',
          w: 440,
          h: 560,
          position: [5.1, 1.45, 3.9],
          quaternion: [0, 0, 0, 1],
          placement: 'anchor',
          anchorId: 'hero-sea',
        },
      ],
      merged.rects,
    );
    expect(restored.windows.a?.lastScreenRect).toEqual({ x: 120, y: 80, w: 440, h: 560 });
  });
});
