import { describe, expect, it, vi } from 'vitest';
import { renderLightMarkdown } from './markdown';
import {
  guardNotes,
  limitNoteText,
  trimInsertion,
  NOTES_MAX_CHARS,
  NOTES_WARN_AT,
  noteNearingLimit,
  packNotes,
  parseIndexValue,
  parseLegacyPack,
  parseStoredNote,
  quarantineKey,
  startNotesSession,
  unpackNotes,
} from './storage';

describe('notes storage', () => {
  it('round-trips notes and refuses an oversized payload', () => {
    const notes = [{ id: '1', title: 'Sea', body: 'q and spaces', updatedAt: 1 }];
    expect(unpackNotes(packNotes(notes))).toEqual(notes);
    expect(unpackNotes('not json')).toEqual([]);
    expect(guardNotes(packNotes(notes))).toBe(true);
    const limited = limitNoteText('x'.repeat(NOTES_MAX_CHARS + 40));
    expect(limited.clipped).toBe(true);
    expect(limited.text.length).toBe(NOTES_MAX_CHARS);
    expect(noteNearingLimit('x'.repeat(NOTES_WARN_AT))).toBe(true);
    expect(noteNearingLimit('short')).toBe(false);
  });

  it('trims a mid-text insert and keeps the tail, including a surrogate pair', () => {
    const tail = 'END';
    const previous = `${'a'.repeat(NOTES_MAX_CHARS - tail.length)}${tail}`;
    const next = `${previous.slice(0, 10)}Z${previous.slice(10)}`;
    const trimmed = trimInsertion(previous, next, 11);
    expect(trimmed.clipped).toBe(true);
    expect(trimmed.text.endsWith('END')).toBe(true);
    expect(trimmed.text.length).toBeLessThanOrEqual(NOTES_MAX_CHARS);
    expect(trimmed.caret).toBe(10);
    const pair = `\uD83D\uDE00`;
    const stuffed = `${previous.slice(0, 10)}${pair}${previous.slice(10)}`;
    const paired = trimInsertion(previous, stuffed, 12);
    expect(paired.text.endsWith('END')).toBe(true);
    expect(paired.text.includes('\uD83D') && !paired.text.includes(pair)).toBe(false);
    const cut = limitNoteText(`${'b'.repeat(NOTES_MAX_CHARS - 1)}\uD83D\uDE00`);
    expect(cut.text.charCodeAt(cut.text.length - 1)).toBeLessThan(0xd800);
  });

  it('migrates a legacy array and quarantines a corrupt record without treating it as empty notes', () => {
    const legacy = packNotes([{ id: '1', title: 'Sea', body: 'grey', updatedAt: 4 }]);
    expect(parseLegacyPack(legacy)).toEqual({
      kind: 'notes',
      notes: [{ id: '1', title: 'Sea', body: 'grey', updatedAt: 4 }],
    });
    expect(parseLegacyPack('{"version":1,"notes":[')).toEqual({ kind: 'corrupt' });
    expect(parseStoredNote({ version: 1, id: '1', title: 'Sea', body: 'grey', updatedAt: 4 })).toEqual({
      kind: 'note',
      version: 1,
      note: { id: '1', title: 'Sea', body: 'grey', updatedAt: 4 },
    });
    expect(parseStoredNote('{"version":1')).toEqual({ kind: 'corrupt' });
    expect(parseIndexValue({ version: 1, ids: ['1'] })).toEqual({ kind: 'ids', ids: ['1'] });
    expect(parseIndexValue({ ids: 'nope' })).toEqual({ kind: 'corrupt' });
    expect(quarantineKey('ghiland:app:notes:note:1', 9)).toBe('ghiland:app:notes:quarantine:9:ghiland:app:notes:note:1');
    expect(unpackNotes('not json')).toEqual([]);
  });

  it('stays the writer when Notes mounts again in the same tab', async () => {
    let requests = 0;
    const nav = globalThis.navigator ?? ({} as Navigator);
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    Object.defineProperty(nav, 'locks', {
      configurable: true,
      value: {
        request(_name: string, _options: LockOptions, callback: (lock: Lock | null) => unknown) {
          requests += 1;
          return callback({ name: 'ghiland-notes-writer' } as Lock);
        },
      },
    });
    expect(await startNotesSession()).toBe('writer');
    expect(await startNotesSession()).toBe('writer');
    expect(requests).toBe(1);
  });

  it('reloads the other tab’s notes when Use here is taken back', async () => {
    vi.resetModules();
    const buckets = new Map<string, Map<string, unknown>>();
    installMemoryIdb(buckets);
    installLocks();
    const storage = await import('./storage');
    const noteA = { id: 'a', title: 'A', body: 'a1', updatedAt: 1_000 };
    expect(await storage.startNotesSession()).toBe('writer');
    expect(await storage.saveNotes([noteA])).toBe('ok');

    const store = buckets.get('ghiland');
    expect(store).toBeTruthy();
    store?.set(storage.recordKey('a'), {
      version: 1,
      updatedAt: 2_000,
      id: 'a',
      title: 'A',
      body: 'a1+b',
    });
    store?.set(storage.recordKey('b1'), {
      version: 1,
      updatedAt: 2_000,
      id: 'b1',
      title: 'B1',
      body: 'from B',
    });
    store?.set(storage.NOTES_INDEX_KEY, { version: 1, ids: ['a', 'b1'] });

    expect(await storage.claimNotesHere()).toBe('writer');
    const loaded = await storage.loadNotes();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.notes.map((note) => note.id).sort()).toEqual(['a', 'b1']);
    expect(loaded.notes.find((note) => note.id === 'a')?.body).toBe('a1+b');
    expect(loaded.notes.find((note) => note.id === 'b1')?.body).toBe('from B');
  });

  it('rebuilds a corrupt index from the note records and leaves it untouched for a reader', async () => {
    vi.resetModules();
    const buckets = new Map<string, Map<string, unknown>>();
    installMemoryIdb(buckets);
    installLocks();
    const storage = await import('./storage');
    expect(await storage.startNotesSession()).toBe('writer');
    expect(
      await storage.saveNotes([{ id: 'a', title: 'A', body: 'kept', updatedAt: 5 }]),
    ).toBe('ok');
    const store = buckets.get('ghiland');
    store?.set(storage.NOTES_INDEX_KEY, '{');

    vi.resetModules();
    installMemoryIdb(buckets);
    installReaderLocks();
    const reader = await import('./storage');
    expect(await reader.startNotesSession()).toBe('reader');
    const hidden = await reader.loadNotes();
    expect(hidden.status).toBe('ok');
    if (hidden.status !== 'ok') return;
    expect(hidden.indexRebuilt).toBe(true);
    expect(hidden.notes.map((note) => note.body)).toEqual(['kept']);
    expect(store?.get(reader.NOTES_INDEX_KEY)).toBe('{');

    vi.resetModules();
    installMemoryIdb(buckets);
    installLocks();
    const writer = await import('./storage');
    expect(await writer.startNotesSession()).toBe('writer');
    const repaired = await writer.loadNotes();
    expect(repaired.status).toBe('ok');
    if (repaired.status !== 'ok') return;
    expect(repaired.indexRebuilt).toBe(true);
    expect(repaired.quarantined).toBeGreaterThan(0);
    expect(repaired.notes.map((note) => note.id)).toEqual(['a']);
    expect(store?.get(writer.NOTES_INDEX_KEY)).toEqual({ version: 1, ids: ['a'] });
    expect([...store!.keys()].some((key) => key.startsWith(writer.NOTES_QUARANTINE_PREFIX))).toBe(true);
  });

  it('reports a full database as a save failure instead of a read failure', async () => {
    vi.resetModules();
    const buckets = new Map<string, Map<string, unknown>>();
    installMemoryIdb(buckets, 'quota');
    installLocks();
    const storage = await import('./storage');
    expect(await storage.startNotesSession()).toBe('writer');
    expect(await storage.saveNotes([{ id: 'a', title: 'A', body: 'a', updatedAt: 1 }])).toBe('quota');
  });

  it('renders a little markdown without letting HTML through', () => {
    expect(renderLightMarkdown('**q** and *space*\n<script>')).toBe(
      '<strong>q</strong> and <em>space</em><br>&lt;script&gt;',
    );
  });
});

function installReaderLocks(): void {
  const nav = globalThis.navigator ?? ({} as Navigator);
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
  Object.defineProperty(nav, 'locks', {
    configurable: true,
    value: {
      request(_name: string, _options: LockOptions, callback: (lock: Lock | null) => unknown) {
        return callback(null);
      },
    },
  });
}

function installLocks(): void {
  const nav = globalThis.navigator ?? ({} as Navigator);
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
  Object.defineProperty(nav, 'locks', {
    configurable: true,
    value: {
      request(_name: string, _options: LockOptions, callback: (lock: Lock | null) => unknown) {
        return callback({ name: 'ghiland-notes-writer' } as Lock);
      },
    },
  });
}

function installMemoryIdb(buckets: Map<string, Map<string, unknown>>, fail: 'quota' | null = null): void {
  const created = new Set<string>();
  const indexedDB = {
    open(name: string) {
      const request: {
        result?: unknown;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        onupgradeneeded: ((event: unknown) => void) | null;
      } = { onsuccess: null, onerror: null, onupgradeneeded: null };
      const bucket = () => {
        let store = buckets.get(name);
        if (!store) {
          store = new Map();
          buckets.set(name, store);
        }
        return store;
      };
      const names = new Set<string>(created.has(name) ? ['kv'] : []);
      const db = {
        objectStoreNames: { contains: (key: string) => names.has(key) },
        createObjectStore(key: string) {
          names.add(key);
          created.add(name);
          bucket();
        },
        transaction() {
          let pending = 0;
          let settled = false;
          const finish = () => {
            if (pending === 0 && !settled) {
              settled = true;
              tx.oncomplete?.();
            }
          };
          const enqueue = (work: () => void) => {
            pending += 1;
            queueMicrotask(() => {
              work();
              pending -= 1;
              queueMicrotask(finish);
            });
          };
          const api = {
            get(key: string) {
              const req: { result?: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
                onsuccess: null,
                onerror: null,
              };
              enqueue(() => {
                req.result = bucket().get(key);
                req.onsuccess?.();
              });
              return req;
            },
            put(value: unknown, key: string) {
              enqueue(() => {
                if (fail === 'quota') {
                  const error = new Error('quota');
                  error.name = 'QuotaExceededError';
                  tx.error = error;
                  settled = true;
                  tx.onabort?.();
                  return;
                }
                bucket().set(key, value);
              });
            },
            delete(key: string) {
              enqueue(() => {
                bucket().delete(key);
              });
            },
            getAllKeys() {
              const req: { result?: string[]; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
                onsuccess: null,
                onerror: null,
              };
              enqueue(() => {
                req.result = [...bucket().keys()];
                req.onsuccess?.();
              });
              return req;
            },
          };
          const tx = {
            error: null as Error | null,
            oncomplete: null as (() => void) | null,
            onerror: null as (() => void) | null,
            onabort: null as (() => void) | null,
            objectStore: () => api,
          };
          return tx;
        },
        close() {},
        onversionchange: null as (() => void) | null,
      };
      request.result = db;
      queueMicrotask(() => {
        if (!names.has('kv')) request.onupgradeneeded?.({});
        request.onsuccess?.();
      });
      return request;
    },
  };
  Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true });
}
