import type { QualitySetting, QualityTier } from '@/contracts/quality';
import type { StorageAdapter } from '@/state/persist';

export const SETTINGS_VERSION = 1;

export interface SettingsData {
  master: number;
  ambient: number;
  interface: number;
  muted: boolean;
  muteWhenHidden: boolean;
  mouseSensitivity: number;
  invertY: boolean;
  fovDeg: number;
  quality: QualitySetting;
  reduceMotion: boolean;
  showPerfHud: boolean;
  lastAutoTier: QualityTier | null;
  /** Failed AUTO climb. Expires after 7 days or a manual quality change (D-022). */
  autoCeiling: { tier: QualityTier; renderer: string; at: number } | null;
}

export const settingsDefaults: SettingsData = {
  master: 0.8,
  ambient: 0.8,
  interface: 0.7,
  muted: false,
  muteWhenHidden: true,
  mouseSensitivity: 1,
  invertY: false,
  fovDeg: 62,
  quality: 'AUTO',
  reduceMotion: false,
  showPerfHud: false,
  lastAutoTier: null,
  autoCeiling: null,
};

const TIERS = new Set<QualitySetting>(['LOW', 'MED', 'HIGH', 'ULTRA', 'AUTO']);
const AUTO_TIERS = new Set<QualityTier>(['LOW', 'MED', 'HIGH', 'ULTRA']);

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** v0 stored Interface volume as `ui`. */
export function migrateSettings(raw: unknown, fromVersion: number): unknown {
  if (!raw || typeof raw !== 'object') return {};
  const data = { ...(raw as Record<string, unknown>) };
  if (fromVersion < 1 && data.interface === undefined && typeof data.ui === 'number') {
    data.interface = data.ui;
  }
  return data;
}

/** Merge onto defaults, then clamp. Missing and garbage fields cannot boot the app into a bad mix. */
export function sanitizeSettings(raw: unknown): SettingsData {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const quality = data.quality;
  const last = data.lastAutoTier;
  return {
    master: clamp(data.master, settingsDefaults.master, 0, 1),
    ambient: clamp(data.ambient, settingsDefaults.ambient, 0, 1),
    interface: clamp(data.interface, settingsDefaults.interface, 0, 1),
    muted: flag(data.muted, settingsDefaults.muted),
    muteWhenHidden: flag(data.muteWhenHidden, settingsDefaults.muteWhenHidden),
    mouseSensitivity: clamp(data.mouseSensitivity, settingsDefaults.mouseSensitivity, 0.1, 3),
    invertY: flag(data.invertY, settingsDefaults.invertY),
    fovDeg: clamp(data.fovDeg, settingsDefaults.fovDeg, 55, 75),
    quality: typeof quality === 'string' && TIERS.has(quality as QualitySetting) ? (quality as QualitySetting) : 'AUTO',
    reduceMotion: flag(data.reduceMotion, settingsDefaults.reduceMotion),
    showPerfHud: flag(data.showPerfHud, settingsDefaults.showPerfHud),
    lastAutoTier: typeof last === 'string' && AUTO_TIERS.has(last as QualityTier) ? (last as QualityTier) : null,
    autoCeiling: readCeiling(data.autoCeiling),
  };
}

function readCeiling(value: unknown): SettingsData['autoCeiling'] {
  if (!value || typeof value !== 'object') return null;
  const data = value as { tier?: unknown; renderer?: unknown; at?: unknown };
  if (typeof data.tier !== 'string' || !AUTO_TIERS.has(data.tier as QualityTier)) return null;
  if (typeof data.renderer !== 'string' || data.renderer.length === 0 || data.renderer.length > 300) return null;
  if (typeof data.at !== 'number' || !Number.isFinite(data.at)) return null;
  return { tier: data.tier as QualityTier, renderer: data.renderer, at: data.at };
}

/** Zustand persist stores `{ state, version }`. A corrupt blob is renamed and discarded. */
export function readPersistedSettings(raw: string | null, key: string, adapter: StorageAdapter): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown; version?: number };
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) throw new Error('shape');
    const version = typeof parsed.version === 'number' ? parsed.version : 0;
    if (version > SETTINGS_VERSION) {
      try {
        adapter.set(`${key}:future-${Date.now()}`, raw);
        adapter.remove(key);
      } catch {
        // The backup itself can fail when storage is blocked. Keep the original key.
      }
      return null;
    }
    const state = sanitizeSettings(migrateSettings(parsed.state, version));
    return JSON.stringify({ state, version: SETTINGS_VERSION });
  } catch {
    adapter.set(`${key}:corrupt-${Date.now()}`, raw);
    adapter.remove(key);
    return null;
  }
}
