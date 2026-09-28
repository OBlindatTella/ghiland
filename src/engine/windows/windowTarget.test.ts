import { describe, expect, it } from 'vitest';
import { isWindowTarget } from '@/engine/windows/windowTarget';

const windowNode = { closest: (selector: string) => (selector === '[data-ghiland-window]' ? {} : null) } as unknown as EventTarget;
const plain = { closest: () => null } as unknown as EventTarget;

describe('isWindowTarget', () => {
  it('matches a window on the target, the composed path, or the element under the pointer', () => {
    expect(isWindowTarget({ target: windowNode, clientX: 0, clientY: 0 }, () => null)).toBe(true);
    expect(isWindowTarget({ target: plain, composedPath: () => [plain, windowNode], clientX: 1, clientY: 1 }, () => null)).toBe(true);
    expect(isWindowTarget({ target: plain, clientX: 4, clientY: 9 }, () => windowNode)).toBe(true);
    expect(isWindowTarget({ target: plain, clientX: 4, clientY: 9 }, () => plain)).toBe(false);
  });
});
