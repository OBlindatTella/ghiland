import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACESFilmicToneMapping, AgXToneMapping } from 'three';

describe('tone mapping', () => {
  it('uses AgX rather than ACES Filmic', () => {
    const source = readFileSync(new URL('./CanvasRoot.tsx', import.meta.url), 'utf8');
    expect(source).toContain('AgXToneMapping');
    expect(source).not.toContain('ACESFilmicToneMapping');
    expect(AgXToneMapping).not.toBe(ACESFilmicToneMapping);
  });
});
