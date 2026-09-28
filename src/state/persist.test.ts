import { afterEach, describe, expect, it, vi } from 'vitest';
import { localStorageAdapter, storageWriteFailed } from '@/state/persist';

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
});
