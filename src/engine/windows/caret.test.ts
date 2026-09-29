import { describe, expect, it } from 'vitest';
import { caretIndexInField } from '@/engine/windows/caret';

describe('pinned click caret', () => {
  it('uses caretPositionFromPoint, then caretRangeFromPoint', () => {
    const field = {
      contains: () => false,
      ownerDocument: {
        caretPositionFromPoint: ((_x: number, _y: number) => ({ offsetNode: null as Node | null, offset: 0 })) as (
          x: number,
          y: number,
        ) => { offsetNode: Node | null; offset: number } | null,
        caretRangeFromPoint: ((_x: number, _y: number) => null) as (x: number, y: number) => Range | null,
      },
    };
    field.ownerDocument.caretPositionFromPoint = () => ({ offsetNode: field as unknown as Node, offset: 12 });
    const hit = caretIndexInField(field as unknown as HTMLTextAreaElement, { x: 40, y: 80 });
    expect(hit).toBe(12);
    field.ownerDocument.caretPositionFromPoint = () => null;
    field.ownerDocument.caretRangeFromPoint = () =>
      ({ startContainer: field as unknown as Node, startOffset: 4 }) as Range;
    expect(caretIndexInField(field as unknown as HTMLTextAreaElement, { x: 10, y: 10 })).toBe(4);
    field.ownerDocument.caretRangeFromPoint = () => null;
    expect(caretIndexInField(field as unknown as HTMLTextAreaElement, { x: 0, y: 0 })).toBeNull();
  });
});
