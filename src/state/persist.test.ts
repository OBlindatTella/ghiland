import { afterEach, describe, expect, it, vi } from 'vitest';
import { armQuotaError, localStorageAdapter, storageWriteFailed } from '@/state/persist';

describe('localStorage adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('swallows a write error instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(localStorageAdapter.get('ghiland:settings')).toBeNull();
    expect(() => localStorageAdapter.set('ghiland:settings', '{}')).not.toThrow();
    expect(storageWriteFailed()).toBe(true);
  });

  it('throws QuotaExceededError from Storage.prototype.setItem once', () => {
    const bucket = new Map<string, string>();
    class MemoryStorage {
      getItem(key: string): string | null {
        return bucket.get(key) ?? null;
      }
      setItem(key: string, value: string): void {
        bucket.set(key, value);
      }
      removeItem(key: string): void {
        bucket.delete(key);
      }
      clear(): void {
        bucket.clear();
      }
      key(): string | null {
        return null;
      }
      get length(): number {
        return bucket.size;
      }
    }
    const storage = new MemoryStorage();
    vi.stubGlobal('Storage', MemoryStorage);
    vi.stubGlobal('localStorage', storage);
    armQuotaError();
    let caught: unknown;
    try {
      localStorage.setItem('ghiland:settings', '{}');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('QuotaExceededError');
    expect(localStorage.getItem('setItem')).toBeNull();
    localStorage.setItem('ghiland:settings', 'ok');
    expect(localStorage.getItem('ghiland:settings')).toBe('ok');
  });
});
