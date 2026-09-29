export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export const NOTES_KEY = 'ghiland:app:notes';
export const NOTES_INDEX_KEY = 'ghiland:app:notes:index';
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

export function limitNoteText(text: string): { text: string; clipped: boolean } {
  if (text.length <= NOTES_MAX_CHARS) return { text, clipped: false };
  return { text: text.slice(0, NOTES_MAX_CHARS), clipped: true };
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

export function notesRole(): Role {
  return role;
}

export function subscribeNotesRole(listener: RoleListener): () => void {
  roleListeners.add(listener);
  return () => {
    roleListeners.delete(listener);
  };
}

function setRole(next: Role): void {
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
  return claimLock(false);
}

export async function claimNotesHere(): Promise<Role> {
  bindChannel();
  channel?.postMessage({ type: 'yield' });
  await new Promise((resolve) => {
    setTimeout(resolve, 40);
  });
  return claimLock(true);
}

export function rememberNotes(notes: readonly Note[]): void {
  memoryCache = notes.map((note) => ({ ...note }));
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

export type LoadNotesResult = { status: 'ok'; notes: Note[] } | { status: 'blocked' } | { status: 'unavailable' };

export async function loadNotes(): Promise<LoadNotesResult> {
  if (memoryCache) return { status: 'ok', notes: memoryCache.map((note) => ({ ...note })) };
  try {
    return await withDb(async (db) => {
      const migrated = await migrateLegacy(db);
      if (migrated === 'unavailable') return { status: 'unavailable' };
      const indexRaw = await idbGet(db, NOTES_INDEX_KEY);
      const index = parseIndexValue(indexRaw);
      if (index.kind === 'corrupt') {
        const moved = await quarantineValue(db, NOTES_INDEX_KEY, indexRaw);
        if (!moved) return { status: 'unavailable' };
        return { status: 'ok', notes: [] };
      }
      const ids = index.kind === 'ids' ? index.ids : [];
      const notes: Note[] = [];
      for (const id of ids) {
        const raw = await idbGet(db, recordKey(id));
        const parsed = parseStoredNote(raw);
        if (parsed.kind === 'empty') continue;
        if (parsed.kind === 'corrupt') {
          const moved = await quarantineValue(db, recordKey(id), raw);
          if (!moved) return { status: 'unavailable' };
          continue;
        }
        if (parsed.version > NOTES_RECORD_VERSION) heldIds.add(parsed.note.id);
        notes.push(parsed.note);
      }
      return { status: 'ok', notes };
    });
  } catch (error) {
    if (isSiteDataBlocked(error)) return { status: 'blocked' };
    return { status: 'unavailable' };
  }
}

export type SaveNotesResult = 'ok' | 'blocked' | 'quota' | 'readonly' | 'unavailable';

export async function saveNotes(notes: readonly Note[]): Promise<SaveNotesResult> {
  if (notesRole() !== 'writer') return 'readonly';
  const limited = notes.map(limitNote);
  memoryCache = limited.map((note) => ({ ...note }));
  try {
    await withDb(async (db) => {
      const index = parseIndexValue(await idbGet(db, NOTES_INDEX_KEY));
      if (index.kind === 'corrupt') throw new Error('notes-index');
      const previous = index.kind === 'ids' ? index.ids : [];
      await writeRecords(db, limited, previous);
    });
    return 'ok';
  } catch (error) {
    if (isSiteDataBlocked(error)) return 'blocked';
    if (isQuotaError(error)) return 'quota';
    return 'unavailable';
  }
}

export async function flushNotes(): Promise<SaveNotesResult> {
  if (!memoryCache || notesRole() !== 'writer') return 'ok';
  return saveNotes(memoryCache);
}
