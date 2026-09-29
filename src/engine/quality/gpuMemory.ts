export interface ComposerBuffers {
  passes: { dispose: () => void }[];
  inputBuffer: { dispose: () => void };
  outputBuffer: { dispose: () => void };
  copyPass?: { dispose: () => void };
  depthRenderTarget?: { dispose: () => void } | null;
}
export function renderTargetBytes(width: number, height: number, samples: number, depth: boolean): number {
  const count = Math.max(1, samples || 1);
  const pixels = Math.max(0, width) * Math.max(0, height) * count;
  return pixels * 8 + (depth ? pixels * 4 : 0);
}

/**
 * Frees this composer's render targets and passes.
 * Does not call `EffectComposer.dispose()`, which also deletes the shared fullscreen geometry.
 */
export function releaseComposerTargets(composer: ComposerBuffers): void {
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
