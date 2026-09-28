import { describe, expect, it } from 'vitest';
import { popScreenLayer, pushScreenLayer } from '@/shell/screen/layers';

describe('Esc layer stack', () => {
  it('releases the Screen when nothing is open', () => {
    expect(popScreenLayer([])).toEqual({ stack: [], release: true, closed: null });
  });

  it('steps back one layer at a time', () => {
    let stack = pushScreenLayer([], 'launcher');
    stack = pushScreenLayer(stack, 'settings');
    stack = pushScreenLayer(stack, 'text');
    const text = popScreenLayer(stack);
    expect(text.closed).toBe('text');
    expect(text.release).toBe(false);
    const settings = popScreenLayer(text.stack);
    expect(settings.closed).toBe('settings');
    const launcher = popScreenLayer(settings.stack);
    expect(launcher.closed).toBe('launcher');
    expect(popScreenLayer(launcher.stack).release).toBe(true);
  });

  it('moves an already open layer to the top instead of duplicating it', () => {
    const stack = pushScreenLayer(pushScreenLayer([], 'settings'), 'settings');
    expect(stack).toEqual(['settings']);
    expect(pushScreenLayer(['launcher', 'settings'], 'launcher')).toEqual(['settings', 'launcher']);
  });
});
