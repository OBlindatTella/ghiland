import { windowsStorageKey } from '@/shell/windows/persistence';
import { armQuotaError } from '@/state/persist';

export { armQuotaError };

/** Appends a pinned record the windows file will quarantine on the next read. */
export function injectMalformedPin(): void {
  if (typeof localStorage === 'undefined') return;
  let pinned: unknown[] = [];
  let rects: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(windowsStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { pinned?: unknown[]; rects?: Record<string, unknown> };
        pinned?: unknown[];
        rects?: Record<string, unknown>;
      };
      const state = parsed.state ?? parsed;
      if (Array.isArray(state.pinned)) pinned = [...state.pinned];
      if (state.rects && typeof state.rects === 'object') rects = state.rects;
    }
  } catch {
    pinned = [];
    rects = {};
  }
  pinned.push({ id: 'malformed-pin', appId: 'notes', worldId: 'seaside-house', placement: 'float' });
  localStorage.setItem(windowsStorageKey, JSON.stringify({ state: { pinned, rects }, version: 1 }));
}
