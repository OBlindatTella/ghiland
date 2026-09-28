export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const localStorageAdapter: StorageAdapter = {
  get: (key) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
  set: (key, value) => {
    localStorage.setItem(key, value);
  },
  remove: (key) => {
    localStorage.removeItem(key);
  },
};
