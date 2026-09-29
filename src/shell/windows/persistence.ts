import type { ScreenRect, Vec3, Quat } from '@/contracts/math';
import type { WindowInstance, WindowMode } from '@/contracts/window';
import { localStorageAdapter } from '@/state/persist';

export const windowsStorageKey = 'ghiland:windows';
export const windowsPersistVersion = 1;

export interface PinnedRecord {
  id: string;
  appId: string;
  title: string;
  worldId: string;
  w: number;
  h: number;
  position: Vec3;
  quaternion: Quat;
  placement: 'anchor' | 'surface' | 'float';
  anchorId?: string;
}

export interface WindowsFile {
  pinned: PinnedRecord[];
  rects: Record<string, ScreenRect>;
}

export const emptyWindowsFile: WindowsFile = { pinned: [], rects: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function rect(value: unknown): ScreenRect | null {
  if (!isRecord(value)) return null;
  const { x, y, w, h } = value;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof w !== 'number' || typeof h !== 'number') return null;
  if (w < 1 || h < 1) return null;
  return { x, y, w, h };
}

function vec3(value: unknown): Vec3 | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) return null;
  return [value[0], value[1], value[2]];
}

function quat(value: unknown): Quat | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  if (value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) return null;
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length < 1e-4) return null;
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}

function pinnedFromUnknown(value: unknown): PinnedRecord | null {
  if (!isRecord(value)) return null;
  const position = vec3(value.position);
  const quaternion = quat(value.quaternion);
  const size = rect({ x: 0, y: 0, w: value.w, h: value.h });
  const placement = value.placement;
  if (!position || !quaternion || !size) return null;
  if (placement !== 'anchor' && placement !== 'surface' && placement !== 'float') return null;
  if (typeof value.id !== 'string' || typeof value.appId !== 'string' || typeof value.worldId !== 'string') return null;
  return {
    id: value.id,
    appId: value.appId,
    title: typeof value.title === 'string' ? value.title : value.appId,
    worldId: value.worldId,
    w: size.w,
    h: size.h,
    position,
    quaternion,
    placement,
    anchorId: typeof value.anchorId === 'string' ? value.anchorId : undefined,
  };
}

function fromLegacyWindows(windows: unknown): WindowsFile {
  if (!Array.isArray(windows)) return emptyWindowsFile;
  const pinned: PinnedRecord[] = [];
  const rects: Record<string, ScreenRect> = {};
  for (const item of windows) {
    if (!isRecord(item) || typeof item.appId !== 'string') continue;
    const saved = rect(item.lastScreenRect);
    if (saved) rects[item.appId] = saved;
    const mode = isRecord(item.mode) ? item.mode : null;
    if (!mode || mode.kind !== 'worldPinned') continue;
    const record = pinnedFromUnknown({
      id: item.id,
      appId: item.appId,
      title: item.title,
      worldId: mode.worldId,
      w: saved?.w,
      h: saved?.h,
      position: mode.position,
      quaternion: mode.quaternion,
      placement: mode.placement,
      anchorId: mode.anchorId,
    });
    if (record) pinned.push(record);
  }
  return { pinned, rects };
}

/** Version 0 stored a window list. Carried windows come back as overlay rects, never as a camera pose. */
export function migrateWindowsFile(raw: unknown, fromVersion: number): WindowsFile {
  if (!isRecord(raw)) return emptyWindowsFile;
  if (fromVersion > windowsPersistVersion) return migrateWindowsFile(raw, windowsPersistVersion);
  if (Array.isArray(raw.windows) && !Array.isArray(raw.pinned)) return fromLegacyWindows(raw.windows);
  const pinned = Array.isArray(raw.pinned) ? raw.pinned.map(pinnedFromUnknown).filter((item): item is PinnedRecord => item !== null) : [];
  const rects: Record<string, ScreenRect> = {};
  if (isRecord(raw.rects)) {
    for (const [appId, value] of Object.entries(raw.rects)) {
      const next = rect(value);
      if (next) rects[appId] = next;
    }
  }
  return { pinned, rects };
}

function pinOf(item: WindowInstance): PinnedRecord {
  if (item.mode.kind !== 'worldPinned') throw new Error('pin');
  return {
    id: item.id,
    appId: item.appId,
    title: item.title,
    worldId: item.mode.worldId,
    w: item.lastScreenRect.w,
    h: item.lastScreenRect.h,
    position: item.mode.position,
    quaternion: item.mode.quaternion,
    placement: item.mode.placement,
    anchorId: item.mode.anchorId,
  };
}

/**
 * Live windows replace pins for the active world. Pins for any other world stay.
 * Rects are merged per app and are never rebuilt from an empty list.
 */
export function fileFromWindows(
  windows: readonly WindowInstance[],
  previous: WindowsFile = emptyWindowsFile,
  activeWorldId?: string | null,
): WindowsFile {
  const rects: Record<string, ScreenRect> = { ...previous.rects };
  const live: PinnedRecord[] = [];
  const touched = new Set<string>();
  if (activeWorldId) touched.add(activeWorldId);
  for (const item of windows) {
    rects[item.appId] = item.lastScreenRect;
    if (item.mode.kind !== 'worldPinned') continue;
    touched.add(item.mode.worldId);
    live.push(pinOf(item));
  }
  const pinned = [...live];
  for (const record of previous.pinned) {
    if (touched.has(record.worldId)) continue;
    pinned.push(record);
  }
  return { pinned, rects };
}

export function malformedPinned(raw: unknown): unknown[] {
  if (!isRecord(raw)) return [];
  const dropped: unknown[] = [];
  if (Array.isArray(raw.pinned)) {
    for (const item of raw.pinned) {
      if (!pinnedFromUnknown(item)) dropped.push(item);
    }
    return dropped;
  }
  if (!Array.isArray(raw.windows)) return dropped;
  for (const item of raw.windows) {
    if (!isRecord(item)) {
      dropped.push(item);
      continue;
    }
    const mode = isRecord(item.mode) ? item.mode : null;
    if (!mode || mode.kind !== 'worldPinned') continue;
    const saved = rect(item.lastScreenRect);
    const record = pinnedFromUnknown({
      id: item.id,
      appId: item.appId,
      title: item.title,
      worldId: mode.worldId,
      w: saved?.w,
      h: saved?.h,
      position: mode.position,
      quaternion: mode.quaternion,
      placement: mode.placement,
      anchorId: mode.anchorId,
    });
    if (!record) dropped.push(item);
  }
  return dropped;
}

export function modeFromPinned(record: PinnedRecord): WindowMode {
  return {
    kind: 'worldPinned',
    worldId: record.worldId,
    position: record.position,
    quaternion: record.quaternion,
    pxPerMeter: 520,
    placement: record.placement,
    anchorId: record.anchorId,
  };
}

interface Envelope {
  state?: unknown;
  version?: number;
}

/** A newer file stays on disk. Parsing it into memory must not write a v1 copy over it. */
let writesHeld = false;

export function windowsWritesHeld(): boolean {
  return writesHeld;
}

function quarantineValues(items: readonly unknown[]): boolean {
  for (const item of items) {
    const key = `${windowsStorageKey}:quarantine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (localStorageAdapter.set(key, JSON.stringify(item)) === false) return false;
  }
  return true;
}

export function readWindowsFile(): WindowsFile {
  writesHeld = false;
  const raw = localStorageAdapter.get(windowsStorageKey);
  if (!raw) return emptyWindowsFile;
  try {
    const parsed = JSON.parse(raw) as Envelope;
    const version = typeof parsed.version === 'number' ? parsed.version : 0;
    if (version > windowsPersistVersion) writesHeld = true;
    const state = parsed.state ?? parsed;
    const dropped = malformedPinned(state);
    const migrated = migrateWindowsFile(state, version);
    if (dropped.length > 0) {
      if (!quarantineValues(dropped)) writesHeld = true;
      else if (!writesHeld) {
        localStorageAdapter.set(windowsStorageKey, JSON.stringify({ state: migrated, version: windowsPersistVersion }));
      }
    }
    return migrated;
  } catch {
    const stamp = Date.now();
    const corrupt = localStorageAdapter.get(windowsStorageKey);
    if (corrupt && localStorageAdapter.set(`${windowsStorageKey}:corrupt-${stamp}`, corrupt) === false) {
      writesHeld = true;
      return emptyWindowsFile;
    }
    localStorageAdapter.remove(windowsStorageKey);
    return emptyWindowsFile;
  }
}

export function writeWindowsFile(file: WindowsFile): void {
  if (writesHeld) return;
  localStorageAdapter.set(windowsStorageKey, JSON.stringify({ state: file, version: windowsPersistVersion }));
}
