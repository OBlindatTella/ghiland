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
/** One localStorage key per dirty note. Notes over {@link MIRROR_MAX_CHARS} are not mirrored. */
export const NOTES_MIRROR_PREFIX = 'ghiland:app:notes:mirror:';
export const MIRROR_MAX_CHARS = 1_000_000;
/** Trailing mirror write. A burst of keystrokes produces at most one write per interval. */
export const MIRROR_TRAIL_MS = 300;
/**
 * Total mirrored characters. Past this, the largest mirrors are dropped first so a notes
 * mirror cannot fill the origin quota that settings and windows also use.
 */
export const MIRROR_BUDGET_CHARS = 3_000_000;

/** Trailing debounce, but never longer than a second after the first dirty key. */
export function notesSaveDelay(sinceFirstDirtyMs: number, trailingMs = 300, maxWaitMs = 1000): number {
  return Math.max(0, Math.min(trailingMs, maxWaitMs - sinceFirstDirtyMs));
}
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
  /** Monotonic per note. A mirror wins at load only when its revision is newer. */
  revision: number;
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
  | { kind: 'note'; note: Note; version: number; revision: number }
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
  const revision = typeof stored.revision === 'number' && Number.isFinite(stored.revision) ? stored.revision : 0;
  return { kind: 'note', note, version, revision };
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
  cancelMirrorTimer();
}

function setRole(next: Role): void {
  if (next === 'reader' && role !== 'reader') dropWriterMemory();
  role = next;
  for (const listener of roleListeners) listener(next);
}

let pagehideBound = false;
let claimDepth = 0;
let inheriting = false;
let suppressInheritUntil = 0;
const YIELD_SUPPRESS_MS = 3_000;
const handoffListeners = new Set<(result: LoadNotesResult) => void>();

function announceLeaderGone(): void {
  if (!channelLeader && !releaseHold) return;
  // Flush while this tab is still the writer. The role drop below clears the in-memory notes.
  if (role === 'writer') void flushNotes();
  channel?.postMessage({ type: 'released', id: TAB_ID });
  channelLeader = false;
  const release = releaseHold;
  releaseHold = null;
  release?.();
  if (role === 'writer') setRole('reader');
}

function onPageShow(event: PageTransitionEvent): void {
  if (!event.persisted || role !== 'reader') return;
  void inheritWriterLock();
}

export function subscribeNotesHandoff(listener: (result: LoadNotesResult) => void): () => void {
  handoffListeners.add(listener);
  return () => {
    handoffListeners.delete(listener);
  };
}

/**
 * A reader that receives the lock (the leader closed) reloads after the lock is held.
 * It does not keep the text it loaded while someone else was writing.
 */
export async function inheritWriterLock(): Promise<Role> {
  if (inheriting || claimDepth > 0 || role !== 'reader') return role;
  inheriting = true;
  try {
    const claimed = await claimLock(false);
    if (claimed !== 'writer') return claimed;
    dropWriterMemory();
    const loaded = await loadNotes();
    for (const listener of [...handoffListeners]) listener(loaded);
    return claimed;
  } finally {
    inheriting = false;
  }
}

function bindChannel(): void {
  if (typeof window !== 'undefined' && !pagehideBound) {
    pagehideBound = true;
    window.addEventListener('pagehide', announceLeaderGone);
    window.addEventListener('pageshow', onPageShow as EventListener);
  }
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel('ghiland-notes');
  channel.onmessage = (event: MessageEvent<{ type?: string; id?: string }>) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'yield') {
      // "Use here" is about to take the lock. Other readers must not elect themselves on the release.
      suppressInheritUntil = Date.now() + YIELD_SUPPRESS_MS;
      if (role === 'writer') void releaseNotesWriter();
      return;
    }
    if (data.type === 'released' && data.id !== TAB_ID && role === 'reader') {
      if (claimDepth > 0 || inheriting || Date.now() < suppressInheritUntil) return;
      void inheritWriterLock();
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
  claimDepth += 1;
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    claimDepth -= 1;
  };
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) {
    return claimByChannel(wait).then(
      (result) => {
        finish();
        return result;
      },
      (error: unknown) => {
        finish();
        throw error;
      },
    );
  }
  leaderNotice = false;
  return new Promise((resolve) => {
    const options: LockOptions = wait ? { mode: 'exclusive' } : { mode: 'exclusive', ifAvailable: true };
    void locks.request(LOCK_NAME, options, (lock) => {
      if (!lock) {
        setRole('reader');
        finish();
        resolve('reader');
        return undefined;
      }
      setRole('writer');
      finish();
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

const committedNotes = new Map<string, number>();
const committedRevision = new Map<string, number>();
const noteRevision = new Map<string, number>();
const bumpedFor = new Map<string, { updatedAt: number; revision: number }>();
const dirtyNotes = new Map<string, Note>();
const lastMirrored = new Map<string, number>();
const ownedMirrorKeys = new Set<string>();
let mirrorKeysKnown = false;
let mirrorTimer = 0;
let mirrorWaitFrom = 0;
let mirrorBound = false;
let inMirror = false;
let bodyPull: (() => void) | null = null;

function cloneNote(note: Note): Note {
  return { id: note.id, title: note.title, body: note.body, updatedAt: note.updatedAt };
}

function later(fn: () => void, ms: number): number {
  const host = typeof window !== 'undefined' && typeof window.setTimeout === 'function' ? window : globalThis;
  return host.setTimeout(fn, ms) as unknown as number;
}

function cancelLater(id: number): void {
  if (!id) return;
  const host = typeof window !== 'undefined' && typeof window.clearTimeout === 'function' ? window : globalThis;
  host.clearTimeout(id);
}

function cancelMirrorTimer(): void {
  if (!mirrorTimer) return;
  cancelLater(mirrorTimer);
  mirrorTimer = 0;
  mirrorWaitFrom = 0;
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

/** The textarea pulls its value at mirror and commit time, not on the keystroke. */
export function bindNotesBodyPull(pull: () => void): () => void {
  bodyPull = pull;
  return () => {
    if (bodyPull === pull) bodyPull = null;
  };
}

function bumpRevision(note: Note): number {
  const known = bumpedFor.get(note.id);
  if (known && known.updatedAt === note.updatedAt) return known.revision;
  const base = Math.max(committedRevision.get(note.id) ?? 0, noteRevision.get(note.id) ?? 0);
  const next = base + 1;
  bumpedFor.set(note.id, { updatedAt: note.updatedAt, revision: next });
  noteRevision.set(note.id, next);
  return next;
}

export function rememberNotes(notes: readonly Note[]): void {
  memoryCache = notes.map(cloneNote);
  if (notesRole() !== 'writer') return;
  const live = new Set(memoryCache.map((note) => note.id));
  for (const id of dirtyNotes.keys()) {
    if (!live.has(id)) dirtyNotes.delete(id);
  }
  for (const note of memoryCache) {
    if (committedNotes.get(note.id) === note.updatedAt) {
      dirtyNotes.delete(note.id);
      continue;
    }
    bumpRevision(note);
    dirtyNotes.set(note.id, note);
  }
  if (!inMirror) scheduleMirror();
}

/** Keystroke entry. Sets the dirty flag and arms the trailing mirror. It does not read the note. */
export function noteTyped(): void {
  if (notesRole() !== 'writer') return;
  scheduleMirror();
}

function scheduleMirror(): void {
  if (notesRole() !== 'writer') return;
  bindMirrorFlush();
  const now = Date.now();
  if (mirrorWaitFrom === 0) mirrorWaitFrom = now;
  if (mirrorTimer) return;
  const delay = Math.max(0, Math.min(MIRROR_TRAIL_MS, MIRROR_TRAIL_MS - (now - mirrorWaitFrom)));
  mirrorTimer = later(() => {
    mirrorTimer = 0;
    mirrorWaitFrom = 0;
    if (notesRole() !== 'writer') return;
    runPullAndWrite();
  }, delay);
}

function runPullAndWrite(): void {
  if (notesRole() !== 'writer' || inMirror) return;
  inMirror = true;
  try {
    bodyPull?.();
  } finally {
    inMirror = false;
  }
  writeMirror([...dirtyNotes.values()]);
}

/** Synchronous mirror write for pagehide and for when the page is hidden. Readers never write. */
export function flushNotesMirror(): void {
  cancelMirrorTimer();
  if (notesRole() !== 'writer') return;
  runPullAndWrite();
}

function mirrorKey(id: string): string {
  return `${NOTES_MIRROR_PREFIX}${id}`;
}

function listMirrorKeys(): string[] {
  const keys: string[] = [];
  try {
    if (typeof localStorage.key !== 'function') return keys;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(NOTES_MIRROR_PREFIX)) keys.push(key);
    }
  } catch {
    /* Storage can throw in a locked-down browser. */
  }
  return keys;
}

function removeMirrorKey(key: string): void {
  ownedMirrorKeys.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* The key is already unreachable. */
  }
}

function knownMirrorKeys(): string[] {
  if (!mirrorKeysKnown) {
    for (const key of listMirrorKeys()) ownedMirrorKeys.add(key);
    mirrorKeysKnown = true;
  }
  return [...ownedMirrorKeys];
}

function mirrorWeight(note: Note): number {
  return note.body.length + note.title.length;
}

function clearMirrorStore(): void {
  removeMirrorKey(NOTES_FLUSH_KEY);
  for (const key of knownMirrorKeys()) removeMirrorKey(key);
  lastMirrored.clear();
  ownedMirrorKeys.clear();
}

function writeOneMirror(note: Note): void {
  const key = mirrorKey(note.id);
  if (mirrorWeight(note) > MIRROR_MAX_CHARS) {
    removeMirrorKey(key);
    lastMirrored.delete(note.id);
    return;
  }
  if (lastMirrored.get(note.id) === note.updatedAt) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: NOTES_RECORD_VERSION,
        revision: noteRevision.get(note.id) ?? 0,
        writtenAt: Date.now(),
        note: cloneNote(note),
      }),
    );
    ownedMirrorKeys.add(key);
    lastMirrored.set(note.id, note.updatedAt);
  } catch {
    removeMirrorKey(key);
    lastMirrored.delete(note.id);
  }
}

function writeMirror(notes: readonly Note[]): void {
  removeMirrorKey(NOTES_FLUSH_KEY);
  const ranked = [...notes].sort((a, b) => mirrorWeight(a) - mirrorWeight(b));
  const accepted: Note[] = [];
  let total = 0;
  for (const note of ranked) {
    const weight = mirrorWeight(note);
    if (weight > MIRROR_MAX_CHARS) {
      removeMirrorKey(mirrorKey(note.id));
      lastMirrored.delete(note.id);
      continue;
    }
    if (total + weight > MIRROR_BUDGET_CHARS) continue;
    accepted.push(note);
    total += weight;
  }
  const live = new Set(accepted.map((note) => note.id));
  for (const key of knownMirrorKeys()) {
    if (!live.has(key.slice(NOTES_MIRROR_PREFIX.length))) removeMirrorKey(key);
  }
  for (const note of notes) {
    if (!live.has(note.id)) {
      removeMirrorKey(mirrorKey(note.id));
      lastMirrored.delete(note.id);
    }
  }
  for (const note of accepted) writeOneMirror(note);
}

function markCommitted(notes: readonly Note[]): void {
  for (const note of notes) {
    committedNotes.set(note.id, note.updatedAt);
    committedRevision.set(note.id, noteRevision.get(note.id) ?? committedRevision.get(note.id) ?? 0);
    const pending = dirtyNotes.get(note.id);
    if (pending && pending.updatedAt === note.updatedAt) {
      dirtyNotes.delete(note.id);
      lastMirrored.delete(note.id);
    }
  }
  if (dirtyNotes.size === 0) clearMirrorStore();
  else writeMirror([...dirtyNotes.values()]);
}

interface MirrorEntry {
  note: Note;
  revision: number;
  writtenAt: number;
}

function readStoredMirror(raw: string): MirrorEntry | null {
  const parsed = JSON.parse(raw) as { note?: Note; revision?: number; writtenAt?: number };
  const note = parsed.note;
  if (!note || typeof note.id !== 'string' || typeof note.title !== 'string' || typeof note.body !== 'string') return null;
  const stored = {
    id: note.id,
    title: note.title,
    body: note.body,
    updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : 0,
  };
  return {
    note: stored,
    revision: typeof parsed.revision === 'number' && Number.isFinite(parsed.revision) ? parsed.revision : 0,
    writtenAt: typeof parsed.writtenAt === 'number' && Number.isFinite(parsed.writtenAt) ? parsed.writtenAt : stored.updatedAt,
  };
}

function readMirror(): MirrorEntry[] {
  const notes: MirrorEntry[] = [];
  for (const key of knownMirrorKeys()) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry = readStoredMirror(raw);
      if (entry) notes.push(entry);
    } catch {
      removeMirrorKey(key);
    }
  }
  return notes;
}

/** Commit dirty notes, waiting at most 2 s, then give up the writer lock. */
export async function releaseNotesWriter(): Promise<void> {
  if (notesRole() !== 'writer') return;
  await Promise.race([flushNotes(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  releaseHold?.();
  releaseHold = null;
  channelLeader = false;
  setRole('reader');
}

export interface MirrorStamp {
  revision?: number;
  writtenAt?: number;
  updatedAt: number;
}

/**
 * A mirror wins only when it is strictly newer than the IndexedDB record.
 * Revision decides when either side has one. Legacy mirrors fall back to the timestamp.
 */
export function mirrorIsNewer(mirror: MirrorStamp, stored: { revision?: number; updatedAt: number }): boolean {
  const mirrorRev = mirror.revision ?? 0;
  const storedRev = stored.revision ?? 0;
  if (mirrorRev > 0 || storedRev > 0) return mirrorRev > storedRev;
  const mirrorTime = mirror.writtenAt ?? mirror.updatedAt;
  return mirrorTime > stored.updatedAt;
}

export function preferNewerNotes(stored: readonly Note[], mirror: readonly Note[] | null): Note[] {
  const merged = new Map<string, Note>();
  for (const note of stored) merged.set(note.id, cloneNote(note));
  for (const note of mirror ?? []) {
    const current = merged.get(note.id);
    const newer = mirrorIsNewer(
      { revision: 0, writtenAt: note.updatedAt, updatedAt: note.updatedAt },
      { revision: 0, updatedAt: current?.updatedAt ?? 0 },
    );
    if (!current || newer) merged.set(note.id, cloneNote(note));
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
    const previous = memoryCache?.map((note) => note.id) ?? [...committedNotes.keys()];
    const stale = previous.filter((id) => !nextIds.includes(id) && !heldIds.has(id));
    const changed = limited.filter((note) => !heldIds.has(note.id) && committedNotes.get(note.id) !== note.updatedAt);
    if (stale.length === 0 && changed.length === 0) {
      markCommitted(limited);
      return Promise.resolve('ok');
    }
    const tx = keptDb.transaction('kv', 'readwrite');
    const store = tx.objectStore('kv');
    for (const id of stale) store.delete(recordKey(id));
    for (const note of changed) store.put(toStored(note), recordKey(note.id));
    store.put({ version: NOTES_RECORD_VERSION, ids: nextIds }, NOTES_INDEX_KEY);
    if ('commit' in tx && typeof tx.commit === 'function') tx.commit();
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
    revision: noteRevision.get(note.id) ?? 0,
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

async function writeRecords(
  db: IDBDatabase,
  notes: readonly Note[],
  previousIds: readonly string[],
  dirtyOnly = false,
): Promise<void> {
  const nextIds = notes.map((note) => note.id);
  const nextSet = new Set(nextIds);
  const deletes = previousIds.filter((id) => !nextSet.has(id) && !heldIds.has(id)).map(recordKey);
  const writes: { key: string; value: unknown }[] = notes
    .filter((note) => !heldIds.has(note.id) && (!dirtyOnly || committedNotes.get(note.id) !== note.updatedAt))
    .map((note) => ({ key: recordKey(note.id), value: toStored(note) }));
  if (dirtyOnly && writes.length === 0 && deletes.length === 0) return;
  writes.push({ key: NOTES_INDEX_KEY, value: { version: NOTES_RECORD_VERSION, ids: nextIds } });
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
    noteRevision.set(parsed.note.id, parsed.revision);
    committedRevision.set(parsed.note.id, parsed.revision);
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
  const storedUpdated = new Map(result.notes.map((note) => [note.id, note.updatedAt]));
  const storedRevision = new Map(result.notes.map((note) => [note.id, committedRevision.get(note.id) ?? 0]));
  const merged = new Map<string, Note>();
  for (const note of result.notes) merged.set(note.id, cloneNote(note));
  for (const entry of mirror) {
    const current = merged.get(entry.note.id);
    const newer = mirrorIsNewer(
      { revision: entry.revision, writtenAt: entry.writtenAt, updatedAt: entry.note.updatedAt },
      { revision: storedRevision.get(entry.note.id) ?? 0, updatedAt: current?.updatedAt ?? 0 },
    );
    if (!current || newer) {
      merged.set(entry.note.id, cloneNote(entry.note));
      noteRevision.set(entry.note.id, Math.max(entry.revision, noteRevision.get(entry.note.id) ?? 0));
    }
  }
  const order = result.notes.map((note) => note.id);
  for (const entry of mirror) {
    if (!order.includes(entry.note.id)) order.push(entry.note.id);
  }
  const notes = order.map((id) => merged.get(id)!);
  committedNotes.clear();
  for (const note of result.notes) committedNotes.set(note.id, storedUpdated.get(note.id) ?? note.updatedAt);
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
      await writeRecords(db, limited, previous, true);
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
