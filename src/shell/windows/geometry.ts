import type { ScreenRect } from '@/contracts/math';

export interface Size {
  w: number;
  h: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function fitRect(rect: ScreenRect, bounds: Bounds): ScreenRect {
  const maxW = Math.max(120, bounds.maxX - bounds.minX);
  const maxH = Math.max(80, bounds.maxY - bounds.minY);
  return dragRect({ ...rect, w: Math.min(rect.w, maxW), h: Math.min(rect.h, maxH) }, 0, 0, bounds);
}

export function dragRect(rect: ScreenRect, dx: number, dy: number, bounds: Bounds): ScreenRect {
  return {
    ...rect,
    x: clamp(rect.x + dx, bounds.minX, bounds.maxX - rect.w),
    y: clamp(rect.y + dy, bounds.minY, bounds.maxY - rect.h),
  };
}

/** Resize from an edge or corner. West and north keep the opposite edge fixed. */
export function resizeRect(
  rect: ScreenRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  min: Size,
  max: Size,
): ScreenRect {
  let { x, y, w, h } = rect;
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  if (edge.includes('e')) w = clamp(rect.w + dx, min.w, max.w);
  if (edge.includes('s')) h = clamp(rect.h + dy, min.h, max.h);
  if (edge.includes('w')) {
    w = clamp(rect.w - dx, min.w, max.w);
    x = right - w;
  }
  if (edge.includes('n')) {
    h = clamp(rect.h - dy, min.h, max.h);
    y = bottom - h;
  }
  return { x, y, w, h };
}

/** First window is centered. Later ones cascade 32 px from the previous, then clamp into the safe area. */
export function placeRect(
  size: Size,
  viewport: Size,
  previous: ScreenRect | null,
  shelfHeight = 88,
): ScreenRect {
  const margin = 24;
  const maxW = Math.max(size.w, viewport.w - margin * 2);
  const maxH = Math.max(size.h, viewport.h - margin - shelfHeight);
  const w = Math.min(size.w, viewport.w - margin * 2);
  const h = Math.min(size.h, viewport.h - margin - shelfHeight);
  let x = Math.round((viewport.w - w) / 2);
  let y = Math.round((viewport.h - shelfHeight - h) / 2);
  if (previous) {
    x = previous.x + 32;
    y = previous.y + 32;
  }
  x = clamp(x, margin, Math.max(margin, viewport.w - margin - w));
  y = clamp(y, margin, Math.max(margin, viewport.h - shelfHeight - h));
  return { x, y, w: Math.min(w, maxW), h: Math.min(h, maxH) };
}
