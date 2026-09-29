import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateWindowsFile, readWindowsFile, windowsPersistVersion, writeWindowsFile } from '@/shell/windows/persistence';

describe('window persistence migration', () => {
  it('turns a version-0 window list into pinned records and drops carried poses', () => {
    const file = migrateWindowsFile(
      {
        windows: [
          {
            id: 'pinned',
            appId: 'notes',
            title: 'Notes',
            lastScreenRect: { x: 10, y: 20, w: 440, h: 560 },
            mode: {
              kind: 'worldPinned',
              worldId: 'seaside-house',
              position: [5.1, 1.45, 3.9],
              quaternion: [0, 0, 0, 1],
              placement: 'anchor',
              anchorId: 'hero-sea',
            },
          },
          {
            id: 'carried',
            appId: 'chat',
            title: 'Chat',
            lastScreenRect: { x: 40, y: 40, w: 440, h: 620 },
            mode: { kind: 'detached', offset: [0, 0, -1.1], lagMs: 150 },
          },
        ],
      },
      0,
    );
    expect(file.pinned).toHaveLength(1);
    expect(file.pinned[0]?.anchorId).toBe('hero-sea');
    expect(file.pinned[0]?.appId).toBe('notes');
    expect(file.rects.chat).toEqual({ x: 40, y: 40, w: 440, h: 620 });
    expect(file.pinned.some((item) => item.appId === 'chat')).toBe(false);
  });

  it('keeps a version-1 file and rejects a future or corrupt one', () => {
    const current = migrateWindowsFile(
      {
        pinned: [
          {
            id: 'a',
            appId: 'notes',
            title: 'Notes',
            worldId: 'seaside-house',
            w: 440,
            h: 560,
            position: [1, 2, 3],
            quaternion: [0, 0, 0, 1],
            placement: 'float',
          },
        ],
        rects: { notes: { x: 1, y: 2, w: 440, h: 560 } },
      },
      windowsPersistVersion,
    );
    expect(current.pinned).toHaveLength(1);
    expect(current.pinned[0]?.placement).toBe('float');
    expect(migrateWindowsFile({ pinned: 'nope' }, 1)).toEqual({ pinned: [], rects: {} });
    expect(migrateWindowsFile({ pinned: [], rects: {} }, windowsPersistVersion + 1)).toEqual({ pinned: [], rects: {} });
  });

  it('reads a future file and does not write a v1 copy over it', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    const original = JSON.stringify({
      version: windowsPersistVersion + 1,
      state: {
        pinned: [
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
            extra: true,
          },
        ],
        rects: {},
      },
    });
    store.set('ghiland:windows', original);
    const file = readWindowsFile();
    expect(file.pinned[0]?.anchorId).toBe('hero-sea');
    writeWindowsFile({ pinned: [], rects: {} });
    expect(store.get('ghiland:windows')).toBe(original);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
