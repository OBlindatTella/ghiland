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

export function composerGpuBytes(composer: {
  inputBuffer: { width: number; height: number; samples?: number; depthBuffer?: boolean };
  outputBuffer: { width: number; height: number; samples?: number; depthBuffer?: boolean };
  depthRenderTarget?: { width: number; height: number; samples?: number } | null;
}): number {
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
  const depth = composer.depthRenderTarget
    ? renderTargetBytes(
        composer.depthRenderTarget.width,
        composer.depthRenderTarget.height,
        composer.depthRenderTarget.samples ?? 1,
        true,
      )
    : 0;
  return input + output + depth;
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
