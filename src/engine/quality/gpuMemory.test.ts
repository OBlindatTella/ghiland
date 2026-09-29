import { describe, expect, it, vi } from 'vitest';
import { composerGpuBytes, frameGpuBytes, HIGH_GPU_BUDGET, releaseComposerTargets, resolvePresentation, trackedGpuBytes, trackGpuBytes, ULTRA_GPU_BUDGET } from '@/engine/quality/gpuMemory';
import { estimateTextureBytes } from '@/worlds/seaside-house/art/textures';

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

  it('picks 4×, then 2×, then SMAA under 384 MB, then DPR and render scale (D-041)', () => {
    const textureBytes = estimateTextureBytes(1024);
    const displays = [
      { name: '1080p', width: 1920, height: 1080 },
      { name: '1440p', width: 2560, height: 1440 },
      { name: '4k', width: 3840, height: 2160 },
    ];
    const expected: Record<string, { samples: 0 | 2 | 4; dpr: number; renderScale: number }> = {
      '1080p@1': { samples: 4, dpr: 1, renderScale: 1 },
      '1080p@1.25': { samples: 4, dpr: 1.25, renderScale: 1 },
      '1080p@1.5': { samples: 2, dpr: 1.5, renderScale: 1 },
      '1440p@1': { samples: 4, dpr: 1, renderScale: 1 },
      '1440p@1.25': { samples: 0, dpr: 1.25, renderScale: 1 },
      '1440p@1.5': { samples: 0, dpr: 1.25, renderScale: 1 },
      '4k@1': { samples: 2, dpr: 1, renderScale: 0.75 },
      '4k@1.25': { samples: 2, dpr: 1, renderScale: 0.75 },
      '4k@1.5': { samples: 2, dpr: 1, renderScale: 0.75 },
    };
    for (const display of displays) {
      for (const deviceDpr of [1, 1.25, 1.5]) {
        const choice = resolvePresentation({
          tier: 'HIGH',
          cssWidth: display.width,
          cssHeight: display.height,
          deviceDpr,
          dprMin: 1,
          dprMax: 1.5,
          shadowMap: 2048,
          textureBytes,
          bloom: true,
        });
        const want = expected[`${display.name}@${deviceDpr}`]!;
        expect(choice.samples, `${display.name} @ ${deviceDpr}`).toBe(want.samples);
        expect(choice.dpr).toBe(want.dpr);
        expect(choice.renderScale).toBe(want.renderScale);
        expect(choice.bytes).toBeLessThanOrEqual(HIGH_GPU_BUDGET);
        expect(choice.bloom).toBe(true);
        expect(choice.bytes).toBe(
          frameGpuBytes({
            width: choice.width,
            height: choice.height,
            samples: choice.samples,
            shadowMap: 2048,
            textureBytes,
            bloom: true,
          }),
        );
        if (choice.samples === 0) {
          expect(choice.smaa).toBe(true);
          expect(choice.foliage).toBe('alphaHash');
        } else {
          expect(choice.foliage).toBe('alphaToCoverage');
        }
      }
    }
    const ultra = resolvePresentation({
      tier: 'ULTRA',
      cssWidth: 1920,
      cssHeight: 1080,
      deviceDpr: 2,
      dprMin: 1,
      dprMax: 2,
      shadowMap: 4096,
      textureBytes,
      bloom: true,
    });
    expect(ultra.samples).toBe(2);
    expect(ultra.bytes).toBeLessThanOrEqual(ULTRA_GPU_BUDGET);
    expect(frameGpuBytes({ width: 3840, height: 2160, samples: 4, shadowMap: 4096, textureBytes, bloom: true })).toBeGreaterThan(ULTRA_GPU_BUDGET);
  });
});
