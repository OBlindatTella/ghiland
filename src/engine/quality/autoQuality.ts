import type { QualityTier } from '@/contracts/quality';

const ORDER: QualityTier[] = ['LOW', 'MED', 'HIGH', 'ULTRA'];

/** AUTO may use LOW, MED and HIGH. It does not climb to ULTRA (D-041). */
export const AUTO_MAX_TIER: QualityTier = 'HIGH';

export const AUTO_CEILING_MS = 7 * 24 * 60 * 60 * 1000;
export const STABLE_HOLD_S = 60;

export interface AutoCeiling {
  /** Highest tier AUTO may use. The tier above this failed and is not retried. */
  tier: QualityTier;
  renderer: string;
  at: number;
}

export interface AutoClock {
  tier: QualityTier;
  /** Inclusive maximum. A failed climb lowers this for the rest of the session. */
  ceiling: QualityTier;
  elapsed: number;
  sinceChange: number;
  held: number;
  lowFor: number;
  /** Time spent under half the tier's target fps. Independent of `lowFor` (D-034). */
  emergencyFor: number;
  highFor: number;
  /** The previous change was a climb. A drop within 60 s then sets the ceiling. */
  climbed: boolean;
  /** Elapsed timestamps of tier changes, for the rolling 5-minute cap (D-031). */
  changes: number[];
  changed: boolean;
  /** Set once, when the current tier has held for 60 s. */
  remember: QualityTier | null;
}

export function initialAutoClock(tier: QualityTier, ceiling: QualityTier = AUTO_MAX_TIER): AutoClock {
  return {
    tier,
    ceiling: capTier(ceiling, AUTO_MAX_TIER),
    elapsed: 0,
    sinceChange: 30,
    held: 0,
    lowFor: 0,
    emergencyFor: 0,
    highFor: 0,
    climbed: false,
    changed: false,
    remember: null,
    changes: [],
  };
}

function indexOf(tier: QualityTier): number {
  return Math.max(0, ORDER.indexOf(tier));
}

/**
 * Drop after 5 s under 45 fps, rise after 5 s over 58 fps.
 * Never in the first 3 s, and at most once per 30 s.
 * A climb that is undone within 60 s becomes the session ceiling (D-022).
 */
export function stepAutoQuality(clock: AutoClock, fps: number, dt: number): AutoClock {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  const elapsed = clock.elapsed + step;
  const sinceChange = clock.sinceChange + step;
  const held = clock.held + step;
  const lowFor = fps < 45 ? clock.lowFor + step : 0;
  const highFor = fps > 58 ? clock.highFor + step : 0;
  const index = indexOf(clock.tier);
  const ceiling = indexOf(clock.ceiling);
  const canChange = elapsed >= 3 && sinceChange >= 30;
  const changes = (clock.changes ?? []).filter((at) => elapsed - at < 300);
  const rateLimited = elapsed >= 60 && changes.length >= 2;
  const targetFps = clock.tier === 'LOW' ? 30 : 60;
  const emergencyFor = fps < targetFps * 0.5 ? (clock.emergencyFor ?? 0) + step : 0;
  const emergency = emergencyFor >= 3;
  const remember = clock.held < STABLE_HOLD_S && held >= STABLE_HOLD_S ? clock.tier : null;
  const normalDrop = canChange && !rateLimited && lowFor >= 5;
  // Once the 2-per-5-minute budget is spent, only a 3 s stretch under half the target may demote.
  const emergencyDrop = rateLimited && emergency;
  if (index > 0 && elapsed >= 3 && (normalDrop || emergencyDrop)) {
    const viaEmergency = emergencyDrop;
    const failedClimb = clock.climbed && sinceChange < STABLE_HOLD_S;
    const next = ORDER[index - 1] ?? clock.tier;
    return {
      tier: next,
      ceiling: viaEmergency || failedClimb ? next : clock.ceiling,
      elapsed,
      sinceChange: 0,
      held: 0,
      lowFor: 0,
      emergencyFor: 0,
      highFor: 0,
      climbed: false,
      changed: true,
      remember: null,
      changes: viaEmergency ? changes : [...changes, elapsed],
    };
  }
  if (!rateLimited && canChange && highFor >= 5 && index < ceiling && index < indexOf(AUTO_MAX_TIER)) {
    return {
      tier: ORDER[index + 1] ?? clock.tier,
      ceiling: clock.ceiling,
      elapsed,
      sinceChange: 0,
      held: 0,
      lowFor: 0,
      emergencyFor: 0,
      highFor: 0,
      climbed: true,
      changed: true,
      remember: null,
      changes: [...changes, elapsed],
    };
  }
  return {
    tier: clock.tier,
    ceiling: clock.ceiling,
    elapsed,
    sinceChange,
    held,
    lowFor,
    emergencyFor,
    highFor,
    climbed: clock.climbed,
    changed: false,
    remember,
    changes,
  };
}

export function capTier(tier: QualityTier, ceiling: QualityTier | null): QualityTier {
  if (!ceiling) return tier;
  return indexOf(tier) > indexOf(ceiling) ? ceiling : tier;
}

export function ceilingStillValid(ceiling: AutoCeiling | null, renderer: string, now: number): QualityTier | null {
  if (!ceiling || ceiling.renderer !== renderer) return null;
  if (now - ceiling.at > AUTO_CEILING_MS) return null;
  return ceiling.tier;
}

export function heuristicTier(input: {
  renderer: string;
  cores: number;
  deviceMemory?: number;
  lastGood?: QualityTier | null;
  ceiling?: AutoCeiling | null;
  now?: number;
}): QualityTier {
  const capped = ceilingStillValid(input.ceiling ?? null, input.renderer, input.now ?? Date.now());
  if (input.lastGood) return capTier(input.lastGood, capped);
  const renderer = input.renderer.toLowerCase();
  const weak =
    /swiftshader|llvmpipe|basic render|intel\(r\) hd|intel\(r\) uhd|intel\(r\) iris\(r\) xe|mali-4|adreno \(tm\) [345]/.test(renderer) ||
    input.cores <= 4 ||
    (input.deviceMemory !== undefined && input.deviceMemory <= 4);
  const tier: QualityTier = weak ? 'LOW' : input.cores >= 8 && (input.deviceMemory === undefined || input.deviceMemory >= 8) ? 'HIGH' : 'MED';
  return capTier(capTier(tier, capped), AUTO_MAX_TIER);
}
