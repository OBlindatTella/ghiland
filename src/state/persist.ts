let writeFailed = false;
const failureListeners = new Set<() => void>();

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void | boolean;
  remove(key: string): void;
}

export function storageWriteFailed(): boolean {
  return writeFailed;
}

export function subscribeStorageFailure(listener: () => void): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

function noteWriteFailure(): void {
  writeFailed = true;
  for (const listener of failureListeners) listener();
}

/**
 * The next `localStorage.setItem` throws `QuotaExceededError` once, then the original write is restored.
 * Used by the test hook. App writes go through `localStorageAdapter`, which catches this and returns false.
 */
export function armQuotaError(): void {
  if (typeof localStorage === 'undefined') return;
  const storage = localStorage;
  const original = storage.setItem.bind(storage);
  let armed = true;
  storage.setItem = (key: string, value: string) => {
    if (!armed) {
      original(key, value);
      return;
    }
    armed = false;
    storage.setItem = original;
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  };
}

export const localStorageAdapter: StorageAdapter = {
  get: (key) => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      noteWriteFailure();
      return false;
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      noteWriteFailure();
    }
  },
};
