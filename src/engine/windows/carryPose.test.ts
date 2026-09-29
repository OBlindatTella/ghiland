import { describe, expect, it } from 'vitest';
import { clearCarry, clearCarryFrames, readCarryFrames, seedCarry, setCarryTrace, stepCarry } from '@/engine/windows/carryPose';

describe('carry spring', () => {
  it('approaches a moved target at 20 fps without ringing past it', () => {
    const id = 'spring';
    const quat = [0, 0, 0, 1] as const;
    seedCarry(id, [0, 0, 0], quat);
    const target = { position: [1, 0, 0] as [number, number, number], quaternion: [...quat] as [number, number, number, number] };
    let previous = 0;
    for (let frame = 0; frame < 30; frame += 1) {
      const next = stepCarry(id, target, 0.05);
      expect(next.position[0]).toBeGreaterThanOrEqual(previous - 1e-4);
      expect(next.position[0]).toBeLessThanOrEqual(1);
      previous = next.position[0];
    }
    expect(previous).toBeGreaterThan(0.85);
    clearCarry(id);
  });

  it('records a position for each stepped frame while the trace is on', () => {
    setCarryTrace(true);
    clearCarryFrames();
    const id = 'trace';
    const quat = [0, 0, 0, 1] as const;
    seedCarry(id, [0, 0, 0], quat);
    stepCarry(id, { position: [1, 0, 0], quaternion: [...quat] }, 1 / 60);
    stepCarry(id, { position: [1, 0, 0], quaternion: [...quat] }, 1 / 60);
    const frames = readCarryFrames();
    expect(frames.map((frame) => frame.id)).toEqual(['trace', 'trace']);
    expect(frames[1]?.position[0]).toBeGreaterThan(frames[0]?.position[0] ?? 0);
    clearCarry(id);
    setCarryTrace(false);
    expect(readCarryFrames()).toEqual([]);
  });
});
