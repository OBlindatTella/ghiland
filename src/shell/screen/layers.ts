/** Inner SCREEN layers. Esc pops exactly one, then leaves the Screen. */
export type ScreenLayer = 'menu' | 'drag' | 'text' | 'settings' | 'launcher';

export function pushScreenLayer(stack: readonly ScreenLayer[], layer: ScreenLayer): ScreenLayer[] {
  if (stack.includes(layer)) return stack.filter((item) => item !== layer).concat(layer);
  return [...stack, layer];
}

/**
 * Pop the top layer. An empty stack means Esc should leave SCREEN for RELEASED.
 * Order, top last: menu, drag, text, settings, launcher — whichever are open.
 */
export function popScreenLayer(stack: readonly ScreenLayer[]): {
  stack: ScreenLayer[];
  release: boolean;
  closed: ScreenLayer | null;
} {
  if (stack.length === 0) return { stack: [], release: true, closed: null };
  return {
    stack: stack.slice(0, -1),
    release: false,
    closed: stack[stack.length - 1] ?? null,
  };
}
