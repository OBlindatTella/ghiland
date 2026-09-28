import type { QualityTier } from '@/contracts/quality';

const ORDER: QualityTier[] = ['LOW', 'MED', 'HIGH', 'ULTRA'];

export interface AutoClock {
  tier: QualityTier;
  elapsed: number;
  sinceChange: number;
  lowFor: number;
  highFor: number;
  changed: boolean;
}

export function initialAutoClock(tier: QualityTier): AutoClock {
  return { tier, elapsed: 0, sinceChange: 30, lowFor: 0, highFor: 0, changed: false };
}

/**
 * Drop after 5 s under 45 fps, rise after 5 s over 58 fps.
 * Never in the first 3 s, and at most once per 30 s.
 */
export function stepAutoQuality(clock: AutoClock, fps: number, dt: number): AutoClock {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  const elapsed = clock.elapsed + step;
  const sinceChange = clock.sinceChange + step;
  const lowFor = fps < 45 ? clock.lowFor + step : 0;
  const highFor = fps > 58 ? clock.highFor + step : 0;
  const index = ORDER.indexOf(clock.tier);
  const canChange = elapsed >= 3 && sinceChange >= 30;
  if (canChange && lowFor >= 5 && index > 0) {
    return {
      tier: ORDER[index - 1] ?? clock.tier,
      elapsed,
      sinceChange: 0,
      lowFor: 0,
      highFor: 0,
      changed: true,
    };
  }
  if (canChange && highFor >= 5 && index < ORDER.length - 1) {
    return {
      tier: ORDER[index + 1] ?? clock.tier,
      elapsed,
      sinceChange: 0,
      lowFor: 0,
      highFor: 0,
      changed: true,
    };
  }
  return { tier: clock.tier, elapsed, sinceChange, lowFor, highFor, changed: false };
}

export function heuristicTier(input: {
  renderer: string;
  cores: number;
  deviceMemory?: number;
  lastGood?: QualityTier | null;
}): QualityTier {
  if (input.lastGood) return input.lastGood;
  const renderer = input.renderer.toLowerCase();
  const weak =
    /swiftshader|llvmpipe|basic render|intel\(r\) hd|intel\(r\) uhd|mali-4|adreno \(tm\) [345]/.test(renderer) ||
    input.cores <= 4 ||
    (input.deviceMemory !== undefined && input.deviceMemory <= 4);
  if (weak) return 'LOW';
  if (input.cores >= 8 && (input.deviceMemory === undefined || input.deviceMemory >= 8)) return 'HIGH';
  return 'MED';
}
