import { describe, expect, it } from 'vitest';
import { popScreenLayer, pushScreenLayer } from '@/shell/screen/layers';
import { useInputStore } from '@/state/input';
import { useScreenStore } from '@/state/screen';

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

  it('clears every layer when the shell leaves SCREEN', () => {
    useInputStore.setState({ shellState: 'SCREEN', owner: 'ui', showClickToWalk: false });
    useScreenStore.getState().push('settings');
    useScreenStore.getState().push('launcher');
    useInputStore.getState().applyModel(
      { state: 'WORLD', relockBlocked: false, showClickToWalk: false },
      'world',
    );
    expect(useScreenStore.getState().stack).toEqual([]);
    useInputStore.getState().reset();
  });
});
