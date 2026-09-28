import { describe, expect, it } from 'vitest';
import { dragRect, placeRect, resizeRect } from '@/shell/windows/geometry';

const bounds = { minX: 24, minY: 24, maxX: 1280, maxY: 700 };

describe('window geometry', () => {
  it('drags 1:1 and keeps the window inside the safe area', () => {
    const moved = dragRect({ x: 100, y: 80, w: 440, h: 560 }, 12, -4, bounds);
    expect(moved).toEqual({ x: 112, y: 76, w: 440, h: 560 });
    const clamped = dragRect({ x: 30, y: 30, w: 200, h: 200 }, -40, -40, bounds);
    expect(clamped.x).toBe(24);
    expect(clamped.y).toBe(24);
  });

  it('resizes from edges and corners without going under the minimum', () => {
    const start = { x: 100, y: 100, w: 440, h: 560 };
    const east = resizeRect(start, 'e', 20, 0, { w: 320, h: 200 }, { w: 800, h: 800 });
    expect(east.w).toBe(460);
    expect(east.x).toBe(100);
    const west = resizeRect(start, 'w', 30, 0, { w: 320, h: 200 }, { w: 800, h: 800 });
    expect(west.w).toBe(410);
    expect(west.x + west.w).toBe(540);
    const tooSmall = resizeRect(start, 'se', -400, -500, { w: 320, h: 200 }, { w: 800, h: 800 });
    expect(tooSmall.w).toBe(320);
    expect(tooSmall.h).toBe(200);
    const corner = resizeRect(start, 'nw', -10, -16, { w: 320, h: 200 }, { w: 900, h: 900 });
    expect(corner.x + corner.w).toBe(540);
    expect(corner.y + corner.h).toBe(660);
  });

  it('centers the first window and cascades the next', () => {
    const first = placeRect({ w: 440, h: 560 }, { w: 1280, h: 800 }, null);
    expect(first.x).toBe(Math.round((1280 - 440) / 2));
    const next = placeRect({ w: 440, h: 560 }, { w: 1280, h: 800 }, first);
    expect(next.x).toBe(first.x + 32);
    expect(next.y).toBe(first.y + 32);
  });
});
