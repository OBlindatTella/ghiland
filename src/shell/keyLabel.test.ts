import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { screenKeyLabel } from '@/shell/keyLabel';

describe('screen key label', () => {
  it('reads the Screen binding and the keyboard layout', () => {
    expect(screenKeyLabel(null)).toBe('Q');
    const azerty = new Map([['KeyQ', 'A']]);
    expect(screenKeyLabel(azerty)).toBe('A');
    expect(screenKeyLabel(null, [{ action: 'toggleScreen', codes: ['KeyA'], owners: ['ui'] }])).toBe('A');
  });

  it('does not hard-code the Screen key in the hint', () => {
    const source = readFileSync(new URL('./ShellChrome.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Click to walk');
    expect(source).toContain('screenKeyLabel');
    expect(source).not.toMatch(/['"`]Q['"`]/);
  });
});
