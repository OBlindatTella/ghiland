export interface DestroyableProgram {
  destroy?: () => void;
}

/**
 * Drops every program three still lists for the current context.
 * `WebGLRenderer` builds a new program cache on restore and does not dispose the previous one,
 * so `info.programs` and the underlying `createProgram` set grow by a full scene each cycle
 * unless the old entries are destroyed first.
 */
export function releasePrograms(programs: DestroyableProgram[]): void {
  const snapshot = programs.slice();
  for (const program of snapshot) {
    try {
      program.destroy?.();
    } catch {
      // A lost context rejects GL deletes. The JS entry still has to leave the cache.
    }
  }
  programs.length = 0;
}

export function releaseRendererPrograms(renderer: { info: { programs: DestroyableProgram[] | null } }): void {
  const programs = renderer.info.programs;
  if (!programs) return;
  releasePrograms(programs);
}
