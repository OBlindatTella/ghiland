import { describe, expect, it } from 'vitest';
import { requestCanvasPointerLock } from '@/engine/input/pointerLock';

function element(requestPointerLock: () => unknown): HTMLElement {
  return { requestPointerLock } as unknown as HTMLElement;
}

describe('requestCanvasPointerLock', () => {
  it('stays unsettled when the browser returns no promise', () => {
    expect(requestCanvasPointerLock(element(() => undefined))).toBe('event');
  });

  it('returns the browser promise when one is given', async () => {
    let settled = false;
    const pending = requestCanvasPointerLock(
      element(() => new Promise<void>((resolve) => {
        setTimeout(() => {
          settled = true;
          resolve();
        }, 0);
      })),
    );
    expect(pending).not.toBe('event');
    expect(settled).toBe(false);
    await pending;
    expect(settled).toBe(true);
  });

  it('does not retry a denied gesture', async () => {
    let calls = 0;
    const pending = requestCanvasPointerLock(element(() => {
      calls += 1;
      throw new DOMException('denied', 'NotAllowedError');
    }));
    await expect(pending).rejects.toThrow(/denied/);
    expect(calls).toBe(1);
  });
});
