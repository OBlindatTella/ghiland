export interface WindowProbe {
  target: EventTarget | null;
  clientX?: number;
  clientY?: number;
  composedPath?: () => EventTarget[];
}

function nodeIsWindow(node: EventTarget | null): boolean {
  const element = node as { closest?: (selector: string) => unknown } | null;
  return Boolean(element?.closest?.('[data-ghiland-window]'));
}

function defaultHit(x: number, y: number): EventTarget | null {
  if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return null;
  return document.elementFromPoint(x, y);
}

/**
 * Windows are DOM siblings of the canvas, so a canvas event target is never inside one.
 * A hit counts when the target, the composed path, or the element under the pointer is a window.
 */
export function isWindowTarget(
  event: WindowProbe,
  elementFromPoint: (x: number, y: number) => EventTarget | null = defaultHit,
): boolean {
  if (nodeIsWindow(event.target)) return true;
  for (const node of event.composedPath?.() ?? []) {
    if (nodeIsWindow(node)) return true;
  }
  if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return false;
  return nodeIsWindow(elementFromPoint(event.clientX, event.clientY));
}
