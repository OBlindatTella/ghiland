import { describe, expect, it } from 'vitest';
import { apps } from './registry';

describe('app registry', () => {
  it('declares native Notes, a native chat mock, and an external fallback', () => {
    expect(apps.map((app) => [app.id, app.integration.kind, app.window.singleton])).toEqual([
      ['notes', 'native', true],
      ['chat', 'native', true],
      ['web', 'external', true],
    ]);
    const web = apps.find((app) => app.id === 'web');
    expect(web?.integration.kind === 'external' && web.integration.url).toBe('https://www.google.com/');
    expect(web?.window.allowedModes).toEqual(['overlay']);
  });
});