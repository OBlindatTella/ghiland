export interface ComposerBuffers {
  passes: { dispose: () => void }[];
  inputBuffer: { dispose: () => void };
  outputBuffer: { dispose: () => void };
  copyPass?: { dispose: () => void };
  depthRenderTarget?: { dispose: () => void } | null;
}
export function renderTargetBytes(width: number, height: number, samples: number, depth: boolean): number {
  const count = Math.max(1, samples || 1);
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const color = w * h * count * 8;
  const depthBytes = depth ? w * h * count * 4 : 0;
  const resolve = count > 1 ? w * h * 8 : 0;
  return color + depthBytes + resolve;
}

/** Canvas color plus depth. The drawing buffer is not one of the composer targets. */
export function defaultFramebufferBytes(width: number, height: number): number {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  return w * h * 8;
}

/** CubeUV PMREM at three's default 256 cube: 768×1024 half-float, plus the depth buffer fromScene enables. */
export function pmremTargetBytes(cubeSize = 256): number {
  const width = 3 * Math.max(cubeSize, 16 * 7);
  const height = 4 * cubeSize;
  return width * height * 8 + width * height * 4;
}

const releasedComposers = new WeakSet<object>();

/**
 * Frees this composer's render targets and passes.
 * Does not call `EffectComposer.dispose()`, which also deletes the shared fullscreen geometry.
 * A second call is a no-op so context loss and the React unmount can both ask.
 */
export function releaseComposerTargets(composer: ComposerBuffers): void {
  if (releasedComposers.has(composer)) return;
  releasedComposers.add(composer);
  for (const pass of [...composer.passes]) pass.dispose();
  composer.passes.length = 0;
  composer.depthRenderTarget?.dispose();
  composer.copyPass?.dispose();
  composer.inputBuffer.dispose();
  composer.outputBuffer.dispose();
}

export function shadowMapBytes(size: number): number {
  if (size <= 0) return 0;
  return size * size * 4;
}

function looksLikeTarget(value: object): value is { width: number; height: number; samples?: number; depthBuffer?: boolean; depthTexture?: unknown; texture?: unknown } {
  const record = value as { width?: unknown; height?: unknown; texture?: unknown; depthTexture?: unknown; depthBuffer?: unknown; samples?: unknown };
  return typeof record.width === 'number' && typeof record.height === 'number' && (record.texture != null || record.depthTexture != null || record.depthBuffer != null || record.samples != null);
}

function walkTargets(value: unknown, seen: Set<unknown>, depth: number): number {
  if (!value || typeof value !== 'object' || seen.has(value) || depth > 4) return 0;
  seen.add(value);
  let total = 0;
  if (looksLikeTarget(value)) {
    total += renderTargetBytes(value.width, value.height, value.samples ?? 1, value.depthBuffer !== false || value.depthTexture != null);
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (Array.isArray(child)) {
      for (const item of child) total += walkTargets(item, seen, depth + 1);
    } else {
      total += walkTargets(child, seen, depth + 1);
    }
  }
  return total;
}

export function composerGpuBytes(composer: {
  inputBuffer: { width: number; height: number; samples?: number; depthBuffer?: boolean };
  outputBuffer: { width: number; height: number; samples?: number; depthBuffer?: boolean };
  depthRenderTarget?: { width: number; height: number; samples?: number } | null;
  passes?: readonly object[];
}): number {
  const seen = new Set<unknown>();
  const input = renderTargetBytes(
    composer.inputBuffer.width,
    composer.inputBuffer.height,
    composer.inputBuffer.samples ?? 0,
    composer.inputBuffer.depthBuffer !== false,
  );
  const output = renderTargetBytes(
    composer.outputBuffer.width,
    composer.outputBuffer.height,
    composer.outputBuffer.samples ?? 0,
    false,
  );
  seen.add(composer.inputBuffer);
  seen.add(composer.outputBuffer);
  const depth = composer.depthRenderTarget
    ? renderTargetBytes(
        composer.depthRenderTarget.width,
        composer.depthRenderTarget.height,
        composer.depthRenderTarget.samples ?? 1,
        true,
      )
    : 0;
  if (composer.depthRenderTarget) seen.add(composer.depthRenderTarget);
  let passes = 0;
  for (const pass of composer.passes ?? []) passes += walkTargets(pass, seen, 0);
  return input + output + depth + passes;
}

const tracked = new Map<number, number>();
let nextId = 1;

export function trackGpuBytes(bytes: number): () => void {
  const id = nextId;
  nextId += 1;
  tracked.set(id, Math.max(0, bytes));
  return () => {
    tracked.delete(id);
  };
}

export function trackedGpuBytes(): number {
  let total = 0;
  for (const value of tracked.values()) total += value;
  return total;
}

export function trackedGpuMb(): number {
  return trackedGpuBytes() / (1024 * 1024);
}

export interface FrameGpuInput {
  width: number;
  height: number;
  samples: 0 | 2 | 4;
  shadowMap: number;
  textureBytes: number;
  bloom: boolean;
}

/** Corrected frame estimate: MSAA plus its resolve, the composer targets, the canvas, shadows, and textures. */
export function frameGpuBytes(input: FrameGpuInput): number {
  const samples = input.samples === 0 ? 1 : input.samples;
  const inputTarget = renderTargetBytes(input.width, input.height, samples, true);
  const output = renderTargetBytes(input.width, input.height, 1, false);
  const depth = renderTargetBytes(input.width, input.height, 1, true);
  // Bloom stays on in the SMAA path (D-041), so its mips are counted at every sample count.
  const bloom = input.bloom ? input.width * input.height * 8 * (1 / 3) : 0;
  const smaa = input.samples === 0 ? input.width * input.height * 4 * 2 : 0;
  return (
    inputTarget +
    output +
    depth +
    defaultFramebufferBytes(input.width, input.height) +
    shadowMapBytes(input.shadowMap) +
    input.textureBytes +
    bloom +
    smaa
  );
}

/** The only GPU-memory estimator. Sample choice and the budget check both use `frameGpuBytes` (D-041). */
export const HIGH_GPU_BUDGET = 384 * 1024 * 1024;
export const ULTRA_GPU_BUDGET = 768 * 1024 * 1024;
export const RENDER_SCALE_FLOOR = 0.75;

export type FoliageAa = 'alphaTest' | 'alphaToCoverage' | 'alphaHash';

export interface PresentationInput {
  tier: 'LOW' | 'MED' | 'HIGH' | 'ULTRA';
  cssWidth: number;
  cssHeight: number;
  deviceDpr: number;
  dprMin: number;
  dprMax: number;
  shadowMap: number;
  textureBytes: number;
  bloom: boolean;
}

export interface Presentation {
  tier: PresentationInput['tier'];
  samples: 0 | 2 | 4;
  dpr: number;
  renderScale: number;
  width: number;
  height: number;
  bytes: number;
  bloom: boolean;
  smaa: boolean;
  foliage: FoliageAa;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Requested DPR first, then 0.25 steps down to `floor`. */
export function dprLadder(requested: number, floor: number): number[] {
  const start = Math.round(requested * 1000) / 1000;
  const steps = [start];
  for (let dpr = Math.floor((start - 1e-6) / 0.25) * 0.25; dpr >= floor - 1e-6; dpr -= 0.25) {
    const value = Math.round(dpr * 4) / 4;
    if (value < floor - 1e-6 || Math.abs(value - start) < 1e-6) continue;
    steps.push(value);
  }
  return steps;
}

/**
 * HIGH stays at or under 384 MB and ULTRA under 768 MB (D-041).
 * Try 4× MSAA, then 2×, then SMAA. If none fits, lower DPR in 0.25 steps to 1.0,
 * then drop render scale to 0.75. Bloom is kept when SMAA is chosen.
 */
export function resolvePresentation(input: PresentationInput): Presentation {
  const requested = clamp(input.deviceDpr, input.dprMin, input.dprMax);
  const budget = input.tier === 'ULTRA' ? ULTRA_GPU_BUDGET : input.tier === 'HIGH' ? HIGH_GPU_BUDGET : Number.POSITIVE_INFINITY;
  const pack = (samples: 0 | 2 | 4, dpr: number, renderScale: number): Presentation => {
    const width = Math.max(1, Math.round(input.cssWidth * dpr * renderScale));
    const height = Math.max(1, Math.round(input.cssHeight * dpr * renderScale));
    const bytes = frameGpuBytes({
      width,
      height,
      samples,
      shadowMap: input.shadowMap,
      textureBytes: input.textureBytes,
      bloom: input.bloom,
    });
    const msaa = input.tier === 'HIGH' || input.tier === 'ULTRA';
    return {
      tier: input.tier,
      samples,
      dpr,
      renderScale,
      width,
      height,
      bytes,
      bloom: input.bloom,
      smaa: samples === 0,
      foliage: !msaa ? 'alphaTest' : samples === 0 ? 'alphaHash' : 'alphaToCoverage',
    };
  };
  if (input.tier !== 'HIGH' && input.tier !== 'ULTRA') return pack(0, requested, 1);
  const minDpr = Math.min(requested, Math.max(1, input.dprMin));
  const order: Array<{ samples: 0 | 2 | 4; dpr: number; scale: number }> = [];
  for (const dpr of dprLadder(requested, minDpr)) {
    order.push({ samples: 4, dpr, scale: 1 }, { samples: 2, dpr, scale: 1 }, { samples: 0, dpr, scale: 1 });
  }
  order.push(
    { samples: 4, dpr: minDpr, scale: RENDER_SCALE_FLOOR },
    { samples: 2, dpr: minDpr, scale: RENDER_SCALE_FLOOR },
    { samples: 0, dpr: minDpr, scale: RENDER_SCALE_FLOOR },
  );
  for (const candidate of order) {
    const choice = pack(candidate.samples, candidate.dpr, candidate.scale);
    if (choice.bytes <= budget) return choice;
  }
  return pack(0, minDpr, RENDER_SCALE_FLOOR);
}
