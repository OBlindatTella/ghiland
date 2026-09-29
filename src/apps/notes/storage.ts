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
  selection?: { start: number; end: number },
): { text: string; caret: number; clipped: boolean } {
  if (next.length <= max) return { text: next, caret, clipped: false };
  if (selection) {
    const start = Math.max(0, Math.min(selection.start, previous.length));
    const end = Math.max(start, Math.min(selection.end, previous.length));
    const room = max - (previous.length - (end - start));
    if (room <= 0) return { text: previous, caret: start, clipped: true };
    const inserted = next.slice(start, Math.min(next.length, Math.max(start, caret)));
    const trimmed = withoutSplitPair(inserted.slice(0, room));
    const text = `${previous.slice(0, start)}${trimmed}${previous.slice(end)}`;
    return { text, caret: start + trimmed.length, clipped: trimmed.length < inserted.length };
  }
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

const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
let role: Role = 'reader';
let releaseHold: (() => void) | null = null;
let channel: BroadcastChannel | null = null;
let channelLeader = false;
let leaderNotice = false;
const roleListeners = new Set<RoleListener>();
const heldIds = new Set<string>();
let memoryCache: Note[] | null = null;
let keptDb: IDBDatabase | null = null;

export function notesRole(): Role {
  return role;
}

export function notesLeaderNotice(): boolean {
  return leaderNotice;
}

/** Lowest id wins when two tabs ask at once and Web Locks are missing. */
export function electNotesLeader(selfId: string, others: readonly string[]): Role {
  const ids = [selfId, ...others.filter((id) => id && id !== selfId)];
  ids.sort();
  return ids[0] === selfId ? 'writer' : 'reader';
}

export function subscribeNotesRole(listener: RoleListener): () => void {
  roleListeners.add(listener);
  return () => {
    roleListeners.delete(listener);
  };
}

function dropWriterMemory(): void {
  memoryCache = null;
  dirtyNotes.clear();
  if (mirrorFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(mirrorFrame);
  mirrorFrame = 0;
}

function setRole(next: Role): void {
  if (next === 'reader' && role !== 'reader') dropWriterMemory();
  role = next;
  for (const listener of roleListeners) listener(next);
}

function bindChannel(): void {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel('ghiland-notes');
  channel.onmessage = (event: MessageEvent<{ type?: string; id?: string }>) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'yield' && role === 'writer') {
      releaseHold?.();
      releaseHold = null;
      channelLeader = false;
      setRole('reader');
      return;
    }
    if (data.type === 'present?' && (channelLeader || releaseHold) && data.id !== TAB_ID) {
      channel?.postMessage({ type: 'leader', id: TAB_ID });
    }
  };
}

function claimByChannel(wait: boolean): Promise<Role> {
  if (typeof BroadcastChannel === 'undefined') {
    leaderNotice = true;
    setRole('writer');
    return Promise.resolve('writer');
  }
  bindChannel();
  if (!wait && (channelLeader || releaseHold)) {
    leaderNotice = false;
    setRole('writer');
    return Promise.resolve('writer');
  }
  return new Promise((resolve) => {
    const others: string[] = [];
    let sawLeader = false;
    const onMessage = (event: MessageEvent<{ type?: string; id?: string }>) => {
      const data = event.data;
      if (!data?.id || data.id === TAB_ID) return;
      if (data.type === 'leader') sawLeader = true;
      if (data.type === 'present?' || data.type === 'leader' || data.type === 'present') others.push(data.id);
    };
    channel?.addEventListener('message', onMessage);
    channel?.postMessage({ type: 'present?', id: TAB_ID });
    setTimeout(() => {
      channel?.removeEventListener('message', onMessage);
      const writer = wait || (!sawLeader && electNotesLeader(TAB_ID, others) === 'writer');
      leaderNotice = false;
      if (!writer) {
        channelLeader = false;
        setRole('reader');
        resolve('reader');
        return;
      }
      channelLeader = true;
      releaseHold = () => {
        releaseHold = null;
        channelLeader = false;
        channel?.postMessage({ type: 'released', id: TAB_ID });
      };
      channel?.postMessage({ type: 'leader', id: TAB_ID });
      setRole('writer');
      resolve('writer');
    }, 30);
  });
}

function claimLock(wait: boolean): Promise<Role> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return claimByChannel(wait);
  leaderNotice = false;
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

/** Above this, the mirror is removed so settings and windows can still be saved. */
const MIRROR_MAX_CHARS = 200_000;
const committedNotes = new Map<string, number>();
const dirtyNotes = new Map<string, Note>();
let mirrorFrame = 0;
let mirrorBound = false;

function cloneNote(note: Note): Note {
  return { id: note.id, title: note.title, body: note.body, updatedAt: note.updatedAt };
}

function bindMirrorFlush(): void {
  if (mirrorBound || typeof window === 'undefined') return;
  mirrorBound = true;
  const flush = () => flushNotesMirror();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export function rememberNotes(notes: readonly Note[]): void {
  memoryCache = notes.map(cloneNote);
  if (notesRole() !== 'writer') return;
  const live = new Set(memoryCache.map((note) => note.id));
  for (const id of dirtyNotes.keys()) {
    if (!live.has(id)) dirtyNotes.delete(id);
  }
  for (const note of memoryCache) {
    if (committedNotes.get(note.id) === note.updatedAt) dirtyNotes.delete(note.id);
    else dirtyNotes.set(note.id, note);
  }
  scheduleMirror();
}

function scheduleMirror(): void {
  bindMirrorFlush();
  if (typeof requestAnimationFrame !== 'function') return;
  if (mirrorFrame) return;
  mirrorFrame = requestAnimationFrame(() => {
    mirrorFrame = 0;
    writeMirror([...dirtyNotes.values()]);
  });
}

/** Synchronous mirror write for pagehide and for when the page is hidden. */
export function flushNotesMirror(): void {
  if (mirrorFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(mirrorFrame);
  mirrorFrame = 0;
  writeMirror([...dirtyNotes.values()]);
}

function clearMirrorStore(): void {
  try {
    localStorage.removeItem(NOTES_FLUSH_KEY);
  } catch {
    /* The key is already unreachable. */
  }
}

function writeMirror(notes: readonly Note[]): void {
  try {
    if (notes.length === 0) {
      clearMirrorStore();
      return;
    }
    let chars = 0;
    for (const note of notes) {
      chars += note.body.length + note.title.length;
      if (chars > MIRROR_MAX_CHARS) {
        clearMirrorStore();
        return;
      }
    }
    const payload = JSON.stringify({ version: NOTES_RECORD_VERSION, notes });
    if (payload.length > MIRROR_MAX_CHARS) {
      clearMirrorStore();
      return;
    }
    localStorage.setItem(NOTES_FLUSH_KEY, payload);
  } catch {
    clearMirrorStore();
  }
}

function markCommitted(notes: readonly Note[]): void {
  for (const note of notes) {
    committedNotes.set(note.id, note.updatedAt);
    const pending = dirtyNotes.get(note.id);
    if (pending && pending.updatedAt === note.updatedAt) dirtyNotes.delete(note.id);
  }
  if (dirtyNotes.size === 0) clearMirrorStore();
  else writeMirror([...dirtyNotes.values()]);
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

export function preferNewerNotes(stored: readonly Note[], mirror: readonly Note[] | null): Note[] {
  const merged = new Map<string, Note>();
  for (const note of stored) merged.set(note.id, cloneNote(note));
  for (const note of mirror ?? []) {
    const current = merged.get(note.id);
    if (!current || note.updatedAt >= current.updatedAt) merged.set(note.id, cloneNote(note));
  }
  const order = stored.map((note) => note.id);
  for (const note of mirror ?? []) {
    if (!order.includes(note.id)) order.push(note.id);
  }
  return order.map((id) => merged.get(id)!);
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
    memoryCache = limited.map((note) => ({ ...note }));
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        markCommitted(limited);
        resolve('ok');
      };
      tx.onerror = () => resolve(saveFailure(tx.error));
      tx.onabort = () => resolve(saveFailure(tx.error));
    });
  } catch (error) {
    return Promise.resolve(saveFailure(error));
  }
}

function saveFailure(error: unknown): SaveNotesResult {
  if (isSiteDataBlocked(error)) return 'blocked';
  if (isQuotaError(error)) return 'quota';
  return 'unavailable';
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
  const mirror = readMirror();
  const notes = preferNewerNotes(result.notes, mirror);
  committedNotes.clear();
  for (const note of result.notes) committedNotes.set(note.id, note.updatedAt);
  dirtyNotes.clear();
  for (const note of notes) {
    if (committedNotes.get(note.id) !== note.updatedAt) dirtyNotes.set(note.id, cloneNote(note));
  }
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
    markCommitted(limited);
    return 'ok';
  } catch (error) {
    return saveFailure(error);
  }
}

export function flushNotes(): Promise<SaveNotesResult> {
  flushNotesMirror();
  if (!memoryCache || notesRole() !== 'writer') return Promise.resolve('ok');
  const kept = flushOpenConnection(memoryCache);
  if (kept) return kept;
  return saveNotes(memoryCache);
}
