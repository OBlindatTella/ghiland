import { describe, expect, it, vi } from 'vitest';
import { composerGpuBytes, releaseComposerTargets, trackedGpuBytes, trackGpuBytes } from '@/engine/quality/gpuMemory';

function target(width: number, height: number, samples: number) {
  return {
    width,
    height,
    samples,
    depthBuffer: true,
    dispose: vi.fn(),
  };
}

function composer(samples: number) {
  return {
    passes: [{ dispose: vi.fn() }],
    inputBuffer: target(1920, 1080, samples),
    outputBuffer: target(1920, 1080, samples),
    copyPass: { dispose: vi.fn() },
    depthRenderTarget: target(1920, 1080, Math.max(1, samples)),
  };
}

describe('composer GPU memory', () => {
  it('does not keep targets from ten MED and HIGH crossings', () => {
    const before = trackedGpuBytes();
    let release = () => {};
    let current: ReturnType<typeof composer> | null = null;
    const retired: Array<ReturnType<typeof vi.fn>> = [];
    for (let i = 0; i < 10; i += 1) {
      const next = composer(i % 2 === 0 ? 0 : 4);
      release();
      if (current) {
        const passDispose = current.passes[0]?.dispose as ReturnType<typeof vi.fn>;
        const inputDispose = current.inputBuffer.dispose;
        releaseComposerTargets(current);
        retired.push(passDispose);
        expect(inputDispose).toHaveBeenCalledOnce();
      }
      current = next;
      release = trackGpuBytes(composerGpuBytes(current));
    }
    expect(retired).toHaveLength(9);
    for (const dispose of retired) expect(dispose).toHaveBeenCalledOnce();
    expect(current).toBeTruthy();
    expect(trackedGpuBytes() - before).toBe(composerGpuBytes(current!));
    release();
    expect(trackedGpuBytes()).toBe(before);
  });
});
