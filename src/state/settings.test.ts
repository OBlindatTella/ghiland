import { describe, expect, it } from 'vitest';
import type { StorageAdapter } from '@/state/persist';
import {
  migrateSettings,
  readPersistedSettings,
  sanitizeSettings,
  settingsDefaults,
} from '@/state/settingsModel';

function memory(): StorageAdapter & { dump: Record<string, string> } {
  const dump: Record<string, string> = {};
  return {
    dump,
    get: (key) => dump[key] ?? null,
    set: (key, value) => {
      dump[key] = value;
    },
    remove: (key) => {
      delete dump[key];
    },
  };
}

describe('settings migration and clamping', () => {
  it('fills missing fields from defaults', () => {
    expect(sanitizeSettings({})).toEqual(settingsDefaults);
    expect(sanitizeSettings(null)).toEqual(settingsDefaults);
  });

  it('clamps volumes, sensitivity, and FOV', () => {
    const next = sanitizeSettings({
      master: 2,
      ambient: -1,
      interface: 0.4,
      mouseSensitivity: 9,
      fovDeg: 90,
    });
    expect(next.master).toBe(1);
    expect(next.ambient).toBe(0);
    expect(next.interface).toBe(0.4);
    expect(next.mouseSensitivity).toBe(3);
    expect(next.fovDeg).toBe(75);
    expect(sanitizeSettings({ fovDeg: 10, mouseSensitivity: 0 }).fovDeg).toBe(55);
    expect(sanitizeSettings({ mouseSensitivity: 0 }).mouseSensitivity).toBe(0.1);
  });

  it('rejects an unknown quality tier', () => {
    expect(sanitizeSettings({ quality: 'CINEMATIC' }).quality).toBe('AUTO');
    expect(sanitizeSettings({ quality: 'LOW' }).quality).toBe('LOW');
  });

  it('copies the v0 Interface volume', () => {
    const migrated = migrateSettings({ ui: 0.25, fovDeg: 70 }, 0);
    expect(sanitizeSettings(migrated).interface).toBe(0.25);
    expect(sanitizeSettings(migrated).fovDeg).toBe(70);
  });

  it('moves a corrupt blob aside and boots from defaults', () => {
    const store = memory();
    store.set('ghiland:settings', '{');
    expect(readPersistedSettings(store.get('ghiland:settings'), 'ghiland:settings', store)).toBeNull();
    expect(store.get('ghiland:settings')).toBeNull();
    expect(Object.keys(store.dump).some((key) => key.startsWith('ghiland:settings:corrupt-'))).toBe(true);
  });

  it('moves a future-version blob aside instead of rewriting it', () => {
    const store = memory();
    const raw = JSON.stringify({ state: { master: 0.2, quality: 'ULTRA' }, version: 9 });
    store.set('ghiland:settings', raw);
    expect(readPersistedSettings(store.get('ghiland:settings'), 'ghiland:settings', store)).toBeNull();
    expect(store.get('ghiland:settings')).toBeNull();
    const backup = Object.entries(store.dump).find(([key]) => key.startsWith('ghiland:settings:future-'));
    expect(backup?.[1]).toBe(raw);
  });

  it('keeps the original blob when the future-version backup cannot be written', () => {
    const store = memory();
    const raw = JSON.stringify({ state: { master: 0.2 }, version: 9 });
    store.set('ghiland:settings', raw);
    const guarded = {
      ...store,
      set: (key: string, value: string) => {
        if (key.includes(':future-') || key.includes(':corrupt-')) return false;
        store.dump[key] = value;
        return true;
      },
    };
    expect(readPersistedSettings(raw, 'ghiland:settings', guarded)).toBeNull();
    expect(guarded.dump['ghiland:settings']).toBe(raw);
  });
});
