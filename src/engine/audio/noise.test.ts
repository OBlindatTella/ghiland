import { describe, expect, it } from 'vitest';
import { fillColouredNoise, NOISE_CHUNK } from '@/engine/audio/noise';

describe('procedural beds', () => {
  it('yields between chunks instead of filling the buffer in one turn', async () => {
    const length = NOISE_CHUNK * 2 + 32;
    const channels = [new Float32Array(length), new Float32Array(length)];
    let pauses = 0;
    const ok = await fillColouredNoise(channels, 48_000, 0.95, 8, () => false, async () => {
      pauses += 1;
    });
    expect(ok).toBe(true);
    expect(pauses).toBeGreaterThan(2);
    expect(channels[0]?.[0]).not.toBe(0);
  });

  it('stops when cancelled so a world exit does not finish the buffer', async () => {
    const channels = [new Float32Array(NOISE_CHUNK * 4)];
    let steps = 0;
    const ok = await fillColouredNoise(channels, 48_000, 0.9, 8, () => steps > 0, async () => {
      steps += 1;
    });
    expect(ok).toBe(false);
    expect(steps).toBe(1);
  });
});