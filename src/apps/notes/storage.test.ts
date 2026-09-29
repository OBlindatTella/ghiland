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
  electNotesLeader,
  notesSaveDelay,
  preferNewerNotes,
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
    const full = 'a'.repeat(NOTES_MAX_CHARS);
    const atLimit = trimInsertion(full, `${full.slice(0, 10)}Z${full.slice(10)}`, 11, NOTES_MAX_CHARS, { start: 10, end: 10 });
    expect(atLimit.text).toBe(full);
    expect(atLimit.caret).toBe(10);
    expect(atLimit.clipped).toBe(true);
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
      revision: 0,
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

  it('elects a single writer when Web Locks are missing', async () => {
    expect(electNotesLeader('a', ['b', 'c'])).toBe('writer');
    expect(electNotesLeader('m', ['a'])).toBe('reader');
    vi.resetModules();
    const nav = globalThis.navigator ?? ({} as Navigator);
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    const previous = Object.getOwnPropertyDescriptor(nav, 'locks');
    Object.defineProperty(nav, 'locks', { configurable: true, value: undefined });
    const storage = await import('./storage');
    const role = await storage.startNotesSession();
    if (role === 'reader') expect(await storage.claimNotesHere()).toBe('writer');
    else expect(role).toBe('writer');
    expect(storage.notesLeaderNotice()).toBe(false);
    expect(await storage.startNotesSession()).toBe('writer');
    if (previous) Object.defineProperty(nav, 'locks', previous);
  });

  it('posts a release on pagehide so a reader can re-elect', async () => {
    vi.resetModules();
    const pagehide = new Set<() => void>();
    vi.stubGlobal('window', {
      addEventListener(type: string, fn: () => void) {
        if (type === 'pagehide') pagehide.add(fn);
      },
      removeEventListener() {},
    });
    const messages: { type?: string; id?: string }[] = [];
    class FakeChannel {
      onmessage: ((event: MessageEvent<{ type?: string; id?: string }>) => void) | null = null;
      postMessage(data: { type?: string; id?: string }) {
        messages.push(data);
      }
      addEventListener() {}
      removeEventListener() {}
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    const nav = globalThis.navigator ?? ({} as Navigator);
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    const previous = Object.getOwnPropertyDescriptor(nav, 'locks');
    Object.defineProperty(nav, 'locks', { configurable: true, value: undefined });
    const storage = await import('./storage');
    expect(await storage.startNotesSession()).toBe('writer');
    for (const fn of pagehide) fn();
    expect(messages.some((item) => item.type === 'released')).toBe(true);
    if (previous) Object.defineProperty(nav, 'locks', previous);
    vi.unstubAllGlobals();
  });

  it('keeps the newer copy of each note when the mirror is only the dirty ones', () => {
    const merged = preferNewerNotes(
      [
        { id: 'a', title: 'A', body: 'old', updatedAt: 1 },
        { id: 'b', title: 'B', body: 'stay', updatedAt: 1 },
      ],
      [{ id: 'a', title: 'A', body: 'new', updatedAt: 2 }],
    );
    expect(merged.map((note) => note.body)).toEqual(['new', 'stay']);
  });

  it('commits at least once a second while typing continues', () => {
    expect(notesSaveDelay(0)).toBe(300);
    expect(notesSaveDelay(800)).toBe(200);
    expect(notesSaveDelay(1000)).toBe(0);
    expect(notesSaveDelay(1500)).toBe(0);
  });

  it('mirrors only dirty notes, clears them after a commit, and removes the mirror when the write fails', async () => {
    vi.resetModules();
    const buckets = new Map<string, Map<string, unknown>>();
    const store = new Map<string, string>();
    let fail = false;
    const storageApi = {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (fail) throw new Error('quota');
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    vi.stubGlobal('localStorage', storageApi);
    installMemoryIdb(buckets);
    installLocks();
    const storage = await import('./storage');
    const mirrorKey = (id: string) => `${storage.NOTES_MIRROR_PREFIX}${id}`;
    expect(await storage.startNotesSession()).toBe('writer');
    const saved = { id: 'a', title: 'A', body: 'one', updatedAt: 1 };
    expect(await storage.saveNotes([saved])).toBe('ok');
    storage.rememberNotes([{ id: 'a', title: 'A', body: 'one+b', updatedAt: 2 }]);
    storage.flushNotesMirror();
    const mirrored = JSON.parse(store.get(mirrorKey('a')) ?? '{}') as { note: { body: string } };
    expect(mirrored.note.body).toBe('one+b');
    expect(await storage.saveNotes([{ id: 'a', title: 'A', body: 'one+b', updatedAt: 2 }])).toBe('ok');
    expect(store.has(mirrorKey('a'))).toBe(false);
    store.set(mirrorKey('a'), 'stale');
    fail = true;
    storage.rememberNotes([{ id: 'a', title: 'A', body: 'x'.repeat(20), updatedAt: 3 }]);
    storage.flushNotesMirror();
    expect(store.has(mirrorKey('a'))).toBe(false);
    fail = false;
    const small = { id: 'a', title: 'A', body: 'kept', updatedAt: 5 };
    const huge = { id: 'b', title: 'B', body: 'y'.repeat(1_500_000), updatedAt: 5 };
    storage.rememberNotes([small, huge]);
    storage.flushNotesMirror();
    expect(JSON.parse(store.get(mirrorKey('a')) ?? '{}').note.body).toBe('kept');
    expect(store.has(mirrorKey('b'))).toBe(false);
    vi.unstubAllGlobals();
  });

  it('commits a note over 200k before handing the lock to another tab', async () => {
    vi.resetModules();
    const buckets = new Map<string, Map<string, unknown>>();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    installMemoryIdb(buckets);
    installLocks();
    const storage = await import('./storage');
    expect(await storage.startNotesSession()).toBe('writer');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const body = `marker-${'z'.repeat(300_000)}`;
    storage.rememberNotes([{ id: 'big', title: 'Big', body, updatedAt: 9 }]);
    await storage.releaseNotesWriter();
    expect(storage.notesRole()).toBe('reader');
    const bucket = buckets.get('ghiland');
    const record = [...(bucket?.values() ?? [])].find((value) => {
      return Boolean(value && typeof value === 'object' && 'body' in value && (value as { body: string }).body.startsWith('marker-'));
    }) as { body: string } | undefined;
    expect(record?.body).toBe(body);
    vi.unstubAllGlobals();
  });

  it('writes the mirror on a 300 ms trail and again immediately on flush', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', memoryStorage(store));
    installLocks();
    const storage = await import('./storage');
    expect(await storage.startNotesSession()).toBe('writer');
    storage.rememberNotes([{ id: 'a', title: 'A', body: 'one', updatedAt: 2 }]);
    const key = `${storage.NOTES_MIRROR_PREFIX}a`;
    vi.advanceTimersByTime(299);
    expect(store.has(key)).toBe(false);
    vi.advanceTimersByTime(1);
    const first = JSON.parse(store.get(key) ?? '{}') as { revision: number; writtenAt: number; note: { body: string } };
    expect(first.note.body).toBe('one');
    expect(first.revision).toBeGreaterThan(0);
    expect(first.writtenAt).toBeGreaterThan(0);
    storage.rememberNotes([{ id: 'a', title: 'A', body: 'two', updatedAt: 3 }]);
    expect(JSON.parse(store.get(key) ?? '{}').note.body).toBe('one');
    storage.flushNotesMirror();
    expect(JSON.parse(store.get(key) ?? '{}').note.body).toBe('two');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps IndexedDB after an A → B → A hand-back and saves the reset textarea', async () => {
    vi.resetModules();
    const harness = installTabHarness();
    const tabA = await import('./storage');
    vi.resetModules();
    const tabB = await import('./storage');
    expect(await tabA.startNotesSession()).toBe('writer');
    await wait(20);
    expect(await tabA.saveNotes([{ id: 'x', title: 'T', body: 'hello', updatedAt: 1_000 }])).toBe('ok');
    expect(await tabB.startNotesSession()).toBe('reader');
    expect(await tabB.claimNotesHere()).toBe('writer');
    expect(tabA.notesRole()).toBe('reader');
    const loadedB = await tabB.loadNotes();
    expect(loadedB.status).toBe('ok');
    if (loadedB.status !== 'ok') return;
    expect(loadedB.notes.find((note) => note.id === 'x')?.body).toBe('hello');
    expect(await tabB.saveNotes([{ id: 'x', title: 'T', body: 'hello world', updatedAt: 2_000 }])).toBe('ok');
    expect(await tabA.claimNotesHere()).toBe('writer');
    const loadedA = await tabA.loadNotes();
    expect(loadedA.status).toBe('ok');
    if (loadedA.status !== 'ok') return;
    expect(loadedA.notes.find((note) => note.id === 'x')?.body).toBe('hello world');
    const field = { value: 'hello' };
    const { assignNoteBody } = await import('./editorInput');
    assignNoteBody(field, loadedA.notes.find((note) => note.id === 'x')?.body ?? '');
    expect(field.value).toBe('hello world');
    field.value += '!';
    expect(await tabA.saveNotes([{ id: 'x', title: 'T', body: field.value, updatedAt: 3_000 }])).toBe('ok');
    expect(noteBody(harness.buckets, 'x')).toBe('hello world!');
    harness.restore();
  });

  it('reloads IndexedDB when the leader closes and does not let a reader mirror wipe it', async () => {
    vi.resetModules();
    const harness = installTabHarness();
    const tabA = await import('./storage');
    vi.resetModules();
    const tabB = await import('./storage');
    expect(await tabA.startNotesSession()).toBe('writer');
    await wait(20);
    expect(await tabA.saveNotes([{ id: 'x', title: 'T', body: 'hello', updatedAt: 1_000 }])).toBe('ok');
    expect(await tabB.startNotesSession()).toBe('reader');
    const stale = await tabB.loadNotes();
    expect(stale.status).toBe('ok');
    if (stale.status !== 'ok') return;
    expect(stale.notes[0]?.body).toBe('hello');
    tabB.rememberNotes([{ id: 'x', title: 'T', body: 'hello plus stale', updatedAt: Date.now() }]);
    tabB.flushNotesMirror();
    expect([...harness.store.keys()].some((key) => key.startsWith(tabB.NOTES_MIRROR_PREFIX))).toBe(false);
    expect(await tabA.saveNotes([{ id: 'x', title: 'T', body: 'hello world', updatedAt: 2_000 }])).toBe('ok');
    const handed = new Promise<import('./storage').LoadNotesResult>((resolve) => {
      tabB.subscribeNotesHandoff(resolve);
    });
    for (const fn of harness.pagehide) fn();
    expect(tabA.notesRole()).toBe('reader');
    const loaded = await handed;
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.notes.find((note) => note.id === 'x')?.body).toBe('hello world');
    expect(noteBody(harness.buckets, 'x')).toBe('hello world');
    expect(tabB.notesRole()).toBe('writer');
    const field = { value: 'hello' };
    const { assignNoteBody } = await import('./editorInput');
    assignNoteBody(field, 'hello world');
    field.value += '!';
    expect(await tabB.saveNotes([{ id: 'x', title: 'T', body: field.value, updatedAt: 3_000 }])).toBe('ok');
    expect(noteBody(harness.buckets, 'x')).toBe('hello world!');
    harness.restore();
  });

  it('lets a mirror win only when its revision is newer than IndexedDB', async () => {
    vi.resetModules();
    const buckets = new Map<string, Map<string, unknown>>();
    const store = new Map<string, string>();
    installMemoryIdb(buckets);
    vi.stubGlobal('localStorage', memoryStorage(store));
    installLocks();
    const storage = await import('./storage');
    const bucket = new Map<string, unknown>();
    buckets.set('ghiland', bucket);
    bucket.set(storage.NOTES_INDEX_KEY, { version: 1, ids: ['x'] });
    bucket.set(storage.recordKey('x'), {
      version: 1,
      revision: 4,
      updatedAt: 10,
      id: 'x',
      title: 'T',
      body: 'committed',
    });
    store.set(
      `${storage.NOTES_MIRROR_PREFIX}x`,
      JSON.stringify({
        version: 1,
        revision: 2,
        writtenAt: 9_999,
        note: { id: 'x', title: 'T', body: 'stale', updatedAt: 9_999 },
      }),
    );
    expect(await storage.startNotesSession()).toBe('writer');
    const older = await storage.loadNotes();
    expect(older.status).toBe('ok');
    if (older.status !== 'ok') return;
    expect(older.notes[0]?.body).toBe('committed');
    vi.resetModules();
    installMemoryIdb(buckets);
    vi.stubGlobal('localStorage', memoryStorage(store));
    installLocks();
    store.set(
      `${storage.NOTES_MIRROR_PREFIX}x`,
      JSON.stringify({
        version: 1,
        revision: 5,
        writtenAt: 11,
        note: { id: 'x', title: 'T', body: 'crashed-edit', updatedAt: 11 },
      }),
    );
    const again = await import('./storage');
    expect(await again.startNotesSession()).toBe('writer');
    const newer = await again.loadNotes();
    expect(newer.status).toBe('ok');
    if (newer.status !== 'ok') return;
    expect(newer.notes[0]?.body).toBe('crashed-edit');
    expect(storage.mirrorIsNewer({ revision: 2, writtenAt: 99, updatedAt: 99 }, { revision: 4, updatedAt: 10 })).toBe(false);
    expect(storage.mirrorIsNewer({ revision: 5, writtenAt: 11, updatedAt: 11 }, { revision: 4, updatedAt: 10 })).toBe(true);
    vi.unstubAllGlobals();
  });

  it('drops the largest mirrors past the budget and does not rewrite an unchanged note', async () => {
    vi.resetModules();
    const store = new Map<string, string>();
    const sets: string[] = [];
    const storageApi = memoryStorage(store);
    const write = storageApi.setItem;
    storageApi.setItem = (key, value) => {
      sets.push(key);
      write(key, value);
    };
    vi.stubGlobal('localStorage', storageApi);
    installLocks();
    const storage = await import('./storage');
    expect(await storage.startNotesSession()).toBe('writer');
    const small = { id: 's', title: 'S', body: 'kept', updatedAt: 1 };
    const other = { id: 'o', title: 'O', body: 'same', updatedAt: 1 };
    storage.rememberNotes([small, other]);
    storage.flushNotesMirror();
    const before = sets.length;
    storage.flushNotesMirror();
    expect(sets.length).toBe(before);
    storage.rememberNotes([{ ...small, body: 'kept!', updatedAt: 2 }, other]);
    sets.length = 0;
    storage.flushNotesMirror();
    expect(sets.filter((key) => key.endsWith(':s'))).toHaveLength(1);
    expect(sets.filter((key) => key.endsWith(':o'))).toHaveLength(0);
    const bulky = [0, 1, 2, 3].map((index) => ({
      id: `b${index}`,
      title: 'B',
      body: 'y'.repeat(900_000),
      updatedAt: 4,
    }));
    storage.rememberNotes(bulky);
    storage.flushNotesMirror();
    const mirrored = [...store.keys()].filter((key) => key.startsWith(storage.NOTES_MIRROR_PREFIX) && key.includes(':b'));
    expect(mirrored.length).toBe(3);
    expect(mirrored.reduce((sum, key) => sum + (store.get(key)?.length ?? 0), 0)).toBeLessThanOrEqual(storage.MIRROR_BUDGET_CHARS + 200);
    vi.unstubAllGlobals();
  });

  it('returns to reader on pagehide and reloads IndexedDB when the page is restored', async () => {
    vi.resetModules();
    const harness = installTabHarness();
    const storage = await import('./storage');
    expect(await storage.startNotesSession()).toBe('writer');
    await wait(20);
    expect(await storage.saveNotes([{ id: 'x', title: 'T', body: 'kept', updatedAt: 4 }])).toBe('ok');
    for (const fn of harness.pagehide) fn();
    await wait(10);
    expect(storage.notesRole()).toBe('reader');
    const bucket = harness.buckets.get('ghiland');
    bucket?.set(storage.recordKey('x'), {
      version: 1,
      revision: 2,
      updatedAt: 8,
      id: 'x',
      title: 'T',
      body: 'from-disk',
    });
    const handed = new Promise<import('./storage').LoadNotesResult>((resolve) => {
      storage.subscribeNotesHandoff(resolve);
    });
    for (const fn of harness.pageshow) fn({ persisted: true });
    const loaded = await handed;
    expect(storage.notesRole()).toBe('writer');
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.notes[0]?.body).toBe('from-disk');
    harness.restore();
  });

  it('does not elect a third tab while Use here is taking the lock', async () => {
    vi.resetModules();
    const harness = installTabHarness();
    const tabA = await import('./storage');
    vi.resetModules();
    const tabB = await import('./storage');
    vi.resetModules();
    const tabC = await import('./storage');
    expect(await tabA.startNotesSession()).toBe('writer');
    await wait(20);
    expect(await tabA.saveNotes([{ id: 'x', title: 'T', body: 'owned', updatedAt: 1 }])).toBe('ok');
    expect(await tabC.startNotesSession()).toBe('reader');
    const roles: string[] = [];
    tabC.subscribeNotesRole((role) => roles.push(role));
    expect(await tabB.startNotesSession()).toBe('reader');
    expect(await tabB.claimNotesHere()).toBe('writer');
    await wait(30);
    expect(tabA.notesRole()).toBe('reader');
    expect(tabC.notesRole()).toBe('reader');
    expect(roles).not.toContain('writer');
    const loaded = await tabB.loadNotes();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.notes[0]?.body).toBe('owned');
    expect(noteBody(harness.buckets, 'x')).toBe('owned');
    harness.restore();
  });

  it('renders a little markdown without letting HTML through', () => {
    expect(renderLightMarkdown('**q** and *space*\n<script>')).toBe(
      '<strong>q</strong> and <em>space</em><br>&lt;script&gt;',
    );
  });
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function noteBody(buckets: Map<string, Map<string, unknown>>, id: string): string | undefined {
  const record = buckets.get('ghiland')?.get(`ghiland:app:notes:note:${id}`) as { body?: string } | undefined;
  return record?.body;
}

function memoryStorage(store: Map<string, string>) {
  return {
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

function installTabHarness() {
  const buckets = new Map<string, Map<string, unknown>>();
  const store = new Map<string, string>();
  const pagehide = new Set<() => void>();
  const pageshow = new Set<(event: { persisted?: boolean }) => void>();
  const peers = new Set<FakeBus>();
  class FakeBus {
    onmessage: ((event: { data: { type?: string; id?: string } }) => void) | null = null;
    private listeners = new Set<(event: { data: { type?: string; id?: string } }) => void>();
    constructor() {
      peers.add(this);
    }
    postMessage(data: { type?: string; id?: string }) {
      for (const peer of peers) {
        if (peer === this) continue;
        const event = { data };
        setTimeout(() => {
          peer.onmessage?.(event);
          for (const listener of peer.listeners) listener(event);
        }, 0);
      }
    }
    addEventListener(_type: string, fn: (event: { data: { type?: string; id?: string } }) => void) {
      this.listeners.add(fn);
    }
    removeEventListener(_type: string, fn: (event: { data: { type?: string; id?: string } }) => void) {
      this.listeners.delete(fn);
    }
  }
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal('window', {
    addEventListener(type: string, fn: (event?: { persisted?: boolean }) => void) {
      if (type === 'pagehide') pagehide.add(fn as () => void);
      if (type === 'pageshow') pageshow.add(fn as (event: { persisted?: boolean }) => void);
    },
    removeEventListener() {},
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
  vi.stubGlobal('BroadcastChannel', FakeBus);
  vi.stubGlobal('localStorage', memoryStorage(store));
  installMemoryIdb(buckets);
  installExclusiveLocks();
  return {
    buckets,
    store,
    pagehide,
    pageshow,
    restore() {
      vi.unstubAllGlobals();
    },
  };
}

function installExclusiveLocks(): void {
  let holder: Promise<unknown> | null = null;
  const waiters: Array<(lock: Lock | null) => unknown> = [];
  const pump = () => {
    if (holder || waiters.length === 0) return;
    const callback = waiters.shift();
    if (!callback) return;
    const result = callback({ name: 'ghiland-notes-writer' } as Lock);
    holder = Promise.resolve(result).then(() => {
      holder = null;
      pump();
    });
  };
  const nav = globalThis.navigator ?? ({} as Navigator);
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
  Object.defineProperty(nav, 'locks', {
    configurable: true,
    value: {
      request(_name: string, options: LockOptions | null, callback: (lock: Lock | null) => unknown) {
        const wait = !options || options.ifAvailable !== true;
        if (!holder) {
          const result = callback({ name: 'ghiland-notes-writer' } as Lock);
          holder = Promise.resolve(result).then(() => {
            holder = null;
            pump();
          });
          return Promise.resolve();
        }
        if (!wait) {
          callback(null);
          return Promise.resolve();
        }
        waiters.push(callback);
        return Promise.resolve();
      },
    },
  });
}

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
