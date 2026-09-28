import { describe, expect, it } from 'vitest';
import { heuristicTier, initialAutoClock, stepAutoQuality } from '@/engine/quality/autoQuality';

function hold(tier: 'LOW' | 'MED' | 'HIGH' | 'ULTRA', fps: number, seconds: number, sinceChange = 30) {
  let clock = { ...initialAutoClock(tier), sinceChange };
  const steps = Math.round(seconds / 0.25);
  for (let i = 0; i < steps; i += 1) clock = stepAutoQuality(clock, fps, 0.25);
  return clock;
}

function advance(clock: ReturnType<typeof initialAutoClock>, fps: number, seconds: number) {
  let next = clock;
  const steps = Math.round(seconds / 0.25);
  for (let i = 0; i < steps; i += 1) next = stepAutoQuality(next, fps, 0.25);
  return next;
}

describe('quality tier hysteresis', () => {
  it('does not change during the first 3 seconds', () => {
    const clock = hold('HIGH', 20, 2.5);
    expect(clock.tier).toBe('HIGH');
    expect(clock.changed).toBe(false);
  });

  it('drops one tier after 5 seconds under 45 fps', () => {
    const clock = hold('HIGH', 30, 5);
    expect(clock.tier).toBe('MED');
    expect(clock.changed).toBe(true);
  });

  it('waits 30 seconds before another change', () => {
    let clock = hold('HIGH', 30, 5);
    expect(clock.tier).toBe('MED');
    clock = advance(clock, 20, 6);
    expect(clock.tier).toBe('MED');
    clock = advance(clock, 50, 24);
    clock = advance(clock, 70, 5);
    expect(clock.tier).toBe('HIGH');
  });

  it('resets a streak when fps sits between the gates', () => {
    let clock = initialAutoClock('MED');
    clock = stepAutoQuality(clock, 30, 4);
    clock = stepAutoQuality(clock, 50, 0.5);
    expect(clock.lowFor).toBe(0);
    expect(clock.tier).toBe('MED');
  });

  it('does not step past the ends of the ladder', () => {
    expect(hold('LOW', 10, 8).tier).toBe('LOW');
    expect(hold('ULTRA', 90, 8).tier).toBe('ULTRA');
  });

  it('does not retry a tier that failed within 60 seconds (D-022)', () => {
    let clock = hold('HIGH', 70, 5);
    expect(clock.tier).toBe('ULTRA');
    expect(clock.climbed).toBe(true);
    clock = advance(clock, 40, 31);
    expect(clock.tier).toBe('HIGH');
    expect(clock.ceiling).toBe('HIGH');
    clock = advance(clock, 70, 40);
    expect(clock.tier).toBe('HIGH');
    expect(clock.changed).toBe(false);
  });

  it('remembers a tier only after it has held for 60 seconds', () => {
    let clock = initialAutoClock('HIGH');
    let remembered: string | null = null;
    for (let t = 0; t < 62; t += 0.25) {
      clock = stepAutoQuality(clock, 55, 0.25);
      if (clock.remember) remembered = clock.remember;
    }
    expect(remembered).toBe('HIGH');
    expect(clock.tier).toBe('HIGH');
  });

  it('prefers the last good tier, otherwise a weak GPU starts low', () => {
    expect(heuristicTier({ renderer: 'NVIDIA', cores: 4, lastGood: 'HIGH' })).toBe('HIGH');
    expect(heuristicTier({ renderer: 'ANGLE (SwiftShader)', cores: 8, deviceMemory: 8 })).toBe('LOW');
    expect(heuristicTier({ renderer: 'NVIDIA GeForce', cores: 8, deviceMemory: 16 })).toBe('HIGH');
  });
});
