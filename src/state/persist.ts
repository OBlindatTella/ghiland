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
