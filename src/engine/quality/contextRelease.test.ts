import { describe, expect, it, vi } from 'vitest';
import { releasePrograms, releaseRendererPrograms } from '@/engine/quality/contextRelease';

function program() {
  return { destroy: vi.fn() };
}

describe('context restore program cache', () => {
  it('keeps info.programs flat across 10 lose/restore cycles', () => {
    const renderer = { info: { programs: [] as ReturnType<typeof program>[] } };
    const destroyed: Array<ReturnType<typeof vi.fn>> = [];
    for (let cycle = 0; cycle < 10; cycle += 1) {
      releaseRendererPrograms(renderer);
      expect(renderer.info.programs).toHaveLength(0);
      for (let i = 0; i < 9; i += 1) {
        const next = program();
        destroyed.push(next.destroy);
        renderer.info.programs.push(next);
      }
      expect(renderer.info.programs).toHaveLength(9);
    }
    releasePrograms(renderer.info.programs);
    expect(renderer.info.programs).toHaveLength(0);
    expect(destroyed).toHaveLength(90);
    for (const destroy of destroyed) expect(destroy).toHaveBeenCalledOnce();
  });
});
