export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export const NOTES_KEY = 'ghiland:app:notes';
export const NOTES_INDEX_KEY = 'ghiland:app:notes:index';
/** Synchronous copy of the latest notes. IndexedDB may abort a transaction that starts as the page unloads. */
export const NOTES_FLUSH_KEY = 'ghiland:app:notes:flush';
export const NOTES_RECORD_PREFIX = 'ghiland:app:notes:note:';
export const NOTES_QUARANTINE_PREFIX = 'ghiland:app:notes:quarantine:';
/** Per note, not the whole store. Past this, only the extra characters are dropped. */
export const NOTES_MAX_CHARS = 2_000_000;
export const NOTES_WARN_AT = Math.floor(NOTES_MAX_CHARS * 0.8);
export const NOTES_RECORD_VERSION = 1;
const LOCK_NAME = 'ghiland-notes-writer';

export interface StoredNote {
  version: number;
  updatedAt: number;
  id: string;
  title: string;
  body: string;
}

function withoutSplitPair(text: string): string {
  if (text.length === 0) return text;
  const last = text.charCodeAt(text.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) return text.slice(0, -1);
  return text;
}

export function limitNoteText(text: string): { text: string; clipped: boolean } {
  if (text.length <= NOTES_MAX_CHARS) return { text, clipped: false };
  const trimmed = withoutSplitPair(text.slice(0, NOTES_MAX_CHARS));
  return { text: trimmed, clipped: true };
}

/**
 * Keep the existing note and shorten only the characters that were just inserted.
 * A mid-text edit at the limit leaves the tail, including a trailing "END", intact.
 */
export function trimInsertion(
  previous: string,
  next: string,
  caret: number,
  max = NOTES_MAX_CHARS,
): { text: string; caret: number; clipped: boolean } {
  if (next.length <= max) return { text: next, caret, clipped: false };
  let prefix = 0;
  const shared = Math.min(previous.length, next.length);
  while (prefix < shared && previous.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous.charCodeAt(previous.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  const inserted = next.slice(prefix, next.length - suffix);
  const keptBefore = previous.slice(0, prefix);
  const keptAfter = suffix > 0 ? previous.slice(previous.length - suffix) : '';
  const room = Math.max(0, max - keptBefore.length - keptAfter.length);
  const trimmed = withoutSplitPair(inserted.slice(0, room));
  const text = `${keptBefore}${trimmed}${keptAfter}`;
  return { text, caret: keptBefore.length + trimmed.length, clipped: trimmed.length < inserted.length };
}

export function noteNearingLimit(text: string): boolean {
  return text.length >= NOTES_WARN_AT;
}

export function guardNotes(raw: string, max = NOTES_MAX_CHARS): boolean {
  return raw.length <= max;
}

export function recordKey(id: string): string {
  return `${NOTES_RECORD_PREFIX}${id}`;
}

export function quarantineKey(original: string, now: number): string {
  return `${NOTES_QUARANTINE_PREFIX}${now}:${original}`;
}

export function packNotes(notes: readonly Note[]): string {
  return JSON.stringify({ version: 1, notes });
}

function asNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null;
  const note = value as Note;
  if (typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.body !== 'string') return null;
  const updatedAt = typeof note.updatedAt === 'number' && Number.isFinite(note.updatedAt) ? note.updatedAt : 0;
  return { id: note.id, title: note.title, body: note.body, updatedAt };
}

export function unpackNotes(raw: string | null): Note[] {
  if (!raw) return [];
  const parsed = parseLegacyPack(raw);
  return parsed.kind === 'notes' ? parsed.notes : [];
}

export type LegacyParse = { kind: 'notes'; notes: Note[] } | { kind: 'corrupt' } | { kind: 'empty' };

export function parseLegacyPack(raw: unknown): LegacyParse {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return { kind: 'corrupt' };
    }
  }
  if (!value || typeof value !== 'object') return { kind: 'corrupt' };
  const notes = (value as { notes?: unknown }).notes;
  if (!Array.isArray(notes)) return { kind: 'corrupt' };
  if (notes.length === 0) return { kind: 'empty' };
  const parsed = notes.map(asNote);
  if (parsed.some((item) => item === null)) return { kind: 'corrupt' };
  return { kind: 'notes', notes: parsed.filter((item): item is Note => item !== null) };
}

export type RecordParse =
  | { kind: 'note'; note: Note; version: number }
  | { kind: 'corrupt' }
  | { kind: 'empty' };

export function parseStoredNote(raw: unknown): RecordParse {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return { kind: 'corrupt' };
    }
  }
  if (value == null) return { kind: 'empty' };
  if (!value || typeof value !== 'object') return { kind: 'corrupt' };
  const stored = value as Partial<StoredNote> & { note?: unknown };
  const version = typeof stored.version === 'number' ? stored.version : null;
  if (version === null) return { kind: 'corrupt' };
  const nested = asNote(stored.note);
  const flat = asNote(stored);
  const note = nested ?? flat;
  if (!note) return { kind: 'corrupt' };
  if (typeof stored.updatedAt === 'number') note.updatedAt = stored.updatedAt;
  return { kind: 'note', note, version };
}

export function isSiteDataBlocked(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  return name === 'SecurityError';
}

export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  return name === 'QuotaExceededError';
}

type Role = 'writer' | 'reader';
type RoleListener = (role: Role) => void;

let role: Role = 'reader';
let releaseHold: (() => void) | null = null;
let channel: BroadcastChannel | null = null;
const roleListeners = new Set<RoleListener>();
const heldIds = new Set<string>();
let memoryCache: Note[] | null = null;
let knownIds: string[] = [];
let keptDb: IDBDatabase | null = null;

export function notesRole(): Role {
  return role;
}

export function subscribeNotesRole(listener: RoleListener): () => void {
  roleListeners.add(listener);
  return () => {
    roleListeners.delete(listener);
  };
}

function dropWriterMemory(): void {
  memoryCache = null;
  knownIds = [];
}

function setRole(next: Role): void {
  if (next === 'reader' && role !== 'reader') dropWriterMemory();
  role = next;
  for (const listener of roleListeners) listener(next);
}

function bindChannel(): void {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel('ghiland-notes');
  channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type !== 'yield' || role !== 'writer') return;
    releaseHold?.();
    releaseHold = null;
    setRole('reader');
  };
}

function claimLock(wait: boolean): Promise<Role> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) {
    setRole('writer');
    return Promise.resolve('writer');
  }
  return new Promise((resolve) => {
    const options: LockOptions = wait ? { mode: 'exclusive' } : { mode: 'exclusive', ifAvailable: true };
    void locks.request(LOCK_NAME, options, (lock) => {
      if (!lock) {
        setRole('reader');
        resolve('reader');
        return undefined;
      }
      setRole('writer');
      resolve('writer');
      return new Promise<void>((done) => {
        releaseHold = () => {
          releaseHold = null;
          done();
        };
      });
    });
  });
}

export async function startNotesSession(): Promise<Role> {
  bindChannel();
  keepDb();
  // Detach and pin move the window between DOM parents, so Notes remounts.
  // This tab already holds the lock; a second request would look like another tab.
  if (releaseHold) {
    setRole('writer');
    return 'writer';
  }
  return claimLock(false);
}

export async function claimNotesHere(): Promise<Role> {
  bindChannel();
  channel?.postMessage({ type: 'yield' });
  await new Promise((resolve) => {
    setTimeout(resolve, 40);
  });
  // The yield may have been our own tab. Either way the next load must not reuse this cache.
  dropWriterMemory();
  return claimLock(true);
}

export function rememberNotes(notes: readonly Note[]): void {
  memoryCache = notes.map((note) => ({ ...note }));
  writeMirror(memoryCache);
}

function writeMirror(notes: readonly Note[]): void {
  try {
    localStorage.setItem(NOTES_FLUSH_KEY, JSON.stringify({ version: NOTES_RECORD_VERSION, notes }));
  } catch {
    /* Quota or blocked storage. A committed IndexedDB transaction still has the notes. */
  }
}

function readMirror(): Note[] | null {
  try {
    const raw = localStorage.getItem(NOTES_FLUSH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { notes?: unknown };
    if (!Array.isArray(parsed.notes)) return null;
    const notes: Note[] = [];
    for (const item of parsed.notes) {
      if (!item || typeof item !== 'object') return null;
      const note = item as Note;
      if (typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.body !== 'string') return null;
      notes.push({
        id: note.id,
        title: note.title,
        body: note.body,
        updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : 0,
      });
    }
    return notes;
  } catch {
    return null;
  }
}

function fresher(stored: readonly Note[], mirror: readonly Note[] | null): Note[] {
  if (!mirror) return stored.map((note) => ({ ...note }));
  const storedStamp = stored.reduce((max, note) => Math.max(max, note.updatedAt), 0);
  const mirrorStamp = mirror.reduce((max, note) => Math.max(max, note.updatedAt), 0);
  const chosen = mirrorStamp >= storedStamp ? mirror : stored;
  return chosen.map((note) => ({ ...note }));
}

/** Open once and leave the connection up so a pagehide flush can start a transaction immediately. */
function keepDb(): void {
  if (keptDb || typeof indexedDB === 'undefined') return;
  let request: IDBOpenDBRequest;
  try {
    request = indexedDB.open('ghiland', 1);
  } catch {
    return;
  }
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv');
  };
  request.onsuccess = () => {
    keptDb = request.result;
    keptDb.onversionchange = () => {
      keptDb?.close();
      keptDb = null;
    };
  };
}

/**
 * Start the write in this turn. A reload aborts a transaction that is still waiting on `indexedDB.open`.
 * Returns null when the connection is not open yet, so the caller can fall back to the async writer.
 */
function flushOpenConnection(notes: readonly Note[]): Promise<SaveNotesResult> | null {
  if (!keptDb) return null;
  const limited = notes.map(limitNote);
  const nextIds = limited.map((note) => note.id);
  try {
    const tx = keptDb.transaction('kv', 'readwrite');
    const store = tx.objectStore('kv');
    const indexRequest = store.get(NOTES_INDEX_KEY);
    indexRequest.onsuccess = () => {
      const index = parseIndexValue(indexRequest.result);
      const previous = index.kind === 'ids' ? index.ids : [];
      const stale = previous.filter((id) => !nextIds.includes(id) && !heldIds.has(id));
      for (const id of stale) store.delete(recordKey(id));
      for (const note of limited) {
        if (heldIds.has(note.id)) continue;
        store.put(toStored(note), recordKey(note.id));
      }
      store.put({ version: NOTES_RECORD_VERSION, ids: nextIds }, NOTES_INDEX_KEY);
    };
    knownIds = nextIds;
    memoryCache = limited.map((note) => ({ ...note }));
    writeMirror(memoryCache);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve('ok');
      tx.onerror = () => resolve('unavailable');
      tx.onabort = () => resolve('unavailable');
    });
  } catch (error) {
    if (isSiteDataBlocked(error)) return Promise.resolve('blocked');
    return Promise.resolve('unavailable');
  }
}

function limitNote(note: Note): Note {
  return {
    ...note,
    title: limitNoteText(note.title).text,
    body: limitNoteText(note.body).text,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open('ghiland', 1);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('indexedDB'));
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = db.transaction('kv', 'readonly').objectStore('kv').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
  });
}

function idbKeys(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const store = db.transaction('kv', 'readonly').objectStore('kv');
    const request = store.getAllKeys();
    request.onsuccess = () => {
      resolve((request.result as IDBValidKey[]).filter((key): key is string => typeof key === 'string'));
    };
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
  });
}

function idbWrite(db: IDBDatabase, writes: readonly { key: string; value: unknown }[], deletes: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    const store = tx.objectStore('kv');
    for (const key of deletes) store.delete(key);
    for (const item of writes) store.put(item.value as never, item.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB'));
  });
}

async function withDb<T>(run: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    return await run(db);
  } finally {
    db.close();
  }
}

function localGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (error) {
    throw error;
  }
}

function localRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* The IDB copy is the one that must survive. */
  }
}

export function parseIndexValue(raw: unknown): { kind: 'ids'; ids: string[] } | { kind: 'empty' } | { kind: 'corrupt' } {
  if (raw == null || raw === '') return { kind: 'empty' };
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return { kind: 'corrupt' };
    }
  }
  if (!value || typeof value !== 'object') return { kind: 'corrupt' };
  const ids = (value as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.some((item) => typeof item !== 'string')) return { kind: 'corrupt' };
  return { kind: 'ids', ids };
}

async function quarantineValue(db: IDBDatabase, key: string, raw: unknown): Promise<boolean> {
  const backup = quarantineKey(key, Date.now());
  try {
    await idbWrite(db, [{ key: backup, value: raw }], []);
  } catch {
    return false;
  }
  try {
    await idbWrite(db, [], [key]);
  } catch {
    return true;
  }
  return true;
}

function toStored(note: Note): StoredNote {
  return {
    version: NOTES_RECORD_VERSION,
    updatedAt: note.updatedAt,
    id: note.id,
    title: note.title,
    body: note.body,
  };
}

async function migrateLegacy(db: IDBDatabase): Promise<'ok' | 'unavailable'> {
  const legacy = await idbGet(db, NOTES_KEY);
  if (legacy == null) {
    const local = localGet(NOTES_KEY);
    if (!local) return 'ok';
    const parsed = parseLegacyPack(local);
    if (parsed.kind === 'corrupt') {
      const moved = await quarantineValue(db, NOTES_KEY, local);
      if (!moved) return 'unavailable';
      localRemove(NOTES_KEY);
      return 'ok';
    }
    if (parsed.kind === 'notes') {
      await writeRecords(db, parsed.notes, []);
      localRemove(NOTES_KEY);
    }
    return 'ok';
  }
  const parsed = parseLegacyPack(legacy);
  if (parsed.kind === 'corrupt') {
    const moved = await quarantineValue(db, NOTES_KEY, legacy);
    return moved ? 'ok' : 'unavailable';
  }
  if (parsed.kind === 'empty') {
    await idbWrite(db, [], [NOTES_KEY]);
    return 'ok';
  }
  if (parsed.kind === 'notes') {
    await writeRecords(db, parsed.notes, []);
    await idbWrite(db, [], [NOTES_KEY]);
  }
  return 'ok';
}

async function writeRecords(db: IDBDatabase, notes: readonly Note[], previousIds: readonly string[]): Promise<void> {
  const nextIds = new Set(notes.map((note) => note.id));
  const deletes = previousIds.filter((id) => !nextIds.has(id) && !heldIds.has(id)).map(recordKey);
  const writes: { key: string; value: unknown }[] = notes
    .filter((note) => !heldIds.has(note.id))
    .map((note) => ({ key: recordKey(note.id), value: toStored(note) }));
  writes.push({ key: NOTES_INDEX_KEY, value: { version: NOTES_RECORD_VERSION, ids: notes.map((note) => note.id) } });
  await idbWrite(db, writes, deletes);
}

export type LoadNotesResult =
  | { status: 'ok'; notes: Note[]; quarantined: number; indexRebuilt: boolean }
  | { status: 'blocked' }
  | { status: 'unavailable' };

function okLoad(notes: Note[], quarantined = 0, indexRebuilt = false): LoadNotesResult {
  return { status: 'ok', notes, quarantined, indexRebuilt };
}

async function readNoteRecords(db: IDBDatabase, ids: readonly string[], write: boolean): Promise<LoadNotesResult> {
  const notes: Note[] = [];
  let quarantined = 0;
  for (const id of ids) {
    const raw = await idbGet(db, recordKey(id));
    const parsed = parseStoredNote(raw);
    if (parsed.kind === 'empty') continue;
    if (parsed.kind === 'corrupt') {
      quarantined += 1;
      if (write) {
        const moved = await quarantineValue(db, recordKey(id), raw);
        if (!moved) return { status: 'unavailable' };
      }
      continue;
    }
    if (parsed.version > NOTES_RECORD_VERSION) heldIds.add(parsed.note.id);
    notes.push(parsed.note);
  }
  return okLoad(notes, quarantined);
}

/** A broken index is rebuilt from the note records. Readers count the damage and do not write. */
async function rebuildFromRecords(db: IDBDatabase, indexRaw: unknown, write: boolean): Promise<LoadNotesResult> {
  if (write) {
    const moved = await quarantineValue(db, NOTES_INDEX_KEY, indexRaw);
    if (!moved) return { status: 'unavailable' };
  }
  const keys = await idbKeys(db);
  const ids = keys
    .filter((key) => key.startsWith(NOTES_RECORD_PREFIX))
    .map((key) => key.slice(NOTES_RECORD_PREFIX.length));
  const read = await readNoteRecords(db, ids, write);
  if (read.status !== 'ok') return read;
  if (write) await writeRecords(db, read.notes, []);
  knownIds = read.notes.map((note) => note.id);
  return okLoad(read.notes, read.quarantined + 1, true);
}

export async function loadNotes(): Promise<LoadNotesResult> {
  if (memoryCache) return okLoad(memoryCache.map((note) => ({ ...note })));
  const write = notesRole() === 'writer';
  try {
    const loaded = await withDb(async (db): Promise<LoadNotesResult> => {
      if (write) {
        const migrated = await migrateLegacy(db);
        if (migrated === 'unavailable') return { status: 'unavailable' };
      }
      const indexRaw = await idbGet(db, NOTES_INDEX_KEY);
      const index = parseIndexValue(indexRaw);
      if (index.kind === 'corrupt') return rebuildFromRecords(db, indexRaw, write);
      const ids = index.kind === 'ids' ? index.ids : [];
      const read = await readNoteRecords(db, ids, write);
      if (read.status === 'ok') knownIds = read.notes.map((note) => note.id);
      return read;
    });
    return withFresherMirror(loaded);
  } catch (error) {
    if (isSiteDataBlocked(error)) return { status: 'blocked' };
    return { status: 'unavailable' };
  }
}

function withFresherMirror(result: LoadNotesResult): LoadNotesResult {
  if (result.status !== 'ok') return result;
  const notes = fresher(result.notes, readMirror());
  return { ...result, notes };
}

export type SaveNotesResult = 'ok' | 'blocked' | 'quota' | 'readonly' | 'unavailable';

export async function saveNotes(notes: readonly Note[]): Promise<SaveNotesResult> {
  if (notesRole() !== 'writer') return 'readonly';
  const kept = flushOpenConnection(notes);
  if (kept) return kept;
  const limited = notes.map(limitNote);
  memoryCache = limited.map((note) => ({ ...note }));
  try {
    await withDb(async (db) => {
      const index = parseIndexValue(await idbGet(db, NOTES_INDEX_KEY));
      if (index.kind === 'corrupt') throw new Error('notes-index');
      const previous = index.kind === 'ids' ? index.ids : [];
      await writeRecords(db, limited, previous);
    });
    knownIds = limited.map((note) => note.id);
    return 'ok';
  } catch (error) {
    if (isSiteDataBlocked(error)) return 'blocked';
    if (isQuotaError(error)) return 'quota';
    return 'unavailable';
  }
}

export function flushNotes(): Promise<SaveNotesResult> {
  if (!memoryCache || notesRole() !== 'writer') return Promise.resolve('ok');
  const kept = flushOpenConnection(memoryCache);
  if (kept) return kept;
  return saveNotes(memoryCache);
}
