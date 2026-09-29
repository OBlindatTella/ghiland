import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { QualitySetting, QualityTier } from '@/contracts/quality';
import { localStorageAdapter, type StorageAdapter } from '@/state/persist';
import {
  readPersistedSettings,
  sanitizeSettings,
  SETTINGS_VERSION,
  settingsDefaults,
  migrateSettings,
  type SettingsData,
} from '@/state/settingsModel';

interface SettingsStore extends SettingsData {
  setMaster: (value: number) => void;
  setAmbient: (value: number) => void;
  setInterface: (value: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setSensitivity: (value: number) => void;
  setFov: (value: number) => void;
  setQuality: (quality: QualitySetting) => void;
  setInvertY: (invertY: boolean) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  setMuteWhenHidden: (muteWhenHidden: boolean) => void;
  setLastAutoTier: (tier: QualityTier) => void;
  setAutoCeiling: (ceiling: SettingsData['autoCeiling']) => void;
  togglePerf: () => void;
}

function settingsStorage(adapter: StorageAdapter) {
  return {
    getItem: (name: string) => readPersistedSettings(adapter.get(name), name, adapter),
    setItem: (name: string, value: string) => adapter.set(name, value),
    removeItem: (name: string) => adapter.remove(name),
  };
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...settingsDefaults,
      setMaster: (master) => set((state) => sanitizeSettings({ ...state, master })),
      setAmbient: (ambient) => set((state) => sanitizeSettings({ ...state, ambient })),
      setInterface: (level) => set((state) => sanitizeSettings({ ...state, interface: level })),
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set((state) => ({ muted: !state.muted })),
      setSensitivity: (mouseSensitivity) => set((state) => sanitizeSettings({ ...state, mouseSensitivity })),
      setFov: (fovDeg) => set((state) => sanitizeSettings({ ...state, fovDeg })),
      setQuality: (quality) =>
        set((state) =>
          sanitizeSettings({ ...state, quality, autoCeiling: quality === 'AUTO' ? state.autoCeiling : null }),
        ),
      setInvertY: (invertY) => set({ invertY }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setMuteWhenHidden: (muteWhenHidden) => set({ muteWhenHidden }),
      setLastAutoTier: (lastAutoTier) => set({ lastAutoTier }),
      setAutoCeiling: (autoCeiling) => set({ autoCeiling }),
      togglePerf: () => set((state) => ({ showPerfHud: !state.showPerfHud })),
    }),
    {
      name: 'ghiland:settings',
      version: SETTINGS_VERSION,
      storage: createJSONStorage(() => settingsStorage(localStorageAdapter)),
      migrate: (persisted, version) => sanitizeSettings(migrateSettings(persisted, version)),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
      partialize: (state) => sanitizeSettings(state),
    },
  ),
);
