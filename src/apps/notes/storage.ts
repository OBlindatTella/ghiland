export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export const NOTES_KEY = 'ghiland:app:notes';
/** Per note, not the whole store. Past this, only the extra characters are dropped. */
export const NOTES_MAX_CHARS = 2_000_000;
export const NOTES_WARN_AT = Math.floor(NOTES_MAX_CHARS * 0.8);

export function packNotes(notes: readonly Note[]): string {
  return JSON.stringify({ version: 1, notes });
}

export function unpackNotes(raw: string | null): Note[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { notes?: unknown };
    if (!Array.isArray(parsed.notes)) return [];
    return parsed.notes.filter((item): item is Note => {
      if (!item || typeof item !== 'object') return false;
      const note = item as Note;
      return typeof note.id === 'string' && typeof note.title === 'string' && typeof note.body === 'string';
    });
  } catch {
    return [];
  }
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

function memory(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

let memoryCache: Note[] | null = null;

/** Same-page remounts (detach, pin) read this before IndexedDB finishes. */
export function rememberNotes(notes: readonly Note[]): void {
  memoryCache = notes.map((note) => ({ ...note }));
  const raw = packNotes(memoryCache);
  if (!guardNotes(raw)) return;
  try {
    memory()?.setItem(NOTES_KEY, raw);
  } catch {
    /* Quota is reported by the async save. */
  }
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ghiland', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(): Promise<string | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('kv', 'readonly').objectStore('kv').get(NOTES_KEY);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function idbPut(raw: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(raw, NOTES_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function newest(notes: readonly Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.updatedAt), 0);
}

export async function loadNotes(): Promise<Note[]> {
  if (memoryCache) return memoryCache.map((note) => ({ ...note }));
  let fromIdb: Note[] = [];
  try {
    const raw = await idbGet();
    if (raw) fromIdb = unpackNotes(raw);
  } catch {
    /* IndexedDB unavailable. Fall through to localStorage. */
  }
  const fromLocal = unpackNotes(memory()?.getItem(NOTES_KEY) ?? null);
  if (newest(fromLocal) > newest(fromIdb)) return fromLocal;
  return fromIdb.length > 0 ? fromIdb : fromLocal;
}

export async function saveNotes(notes: readonly Note[]): Promise<'ok' | 'too-large'> {
  const limited = notes.map((note) => ({
    ...note,
    title: limitNoteText(note.title).text,
    body: limitNoteText(note.body).text,
  }));
  const raw = packNotes(limited);
  try {
    await idbPut(raw);
    return 'ok';
  } catch {
    try {
      memory()?.setItem(NOTES_KEY, raw);
      return 'ok';
    } catch {
      return 'too-large';
    }
  }
}
