export interface CaretPoint {
  x: number;
  y: number;
}

type CaretHost = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function indexFrom(field: HTMLElement, node: Node | null, offset: number): number | null {
  if (!node) return null;
  if (node !== field && !field.contains(node)) return null;
  return offset;
}

/** Where a world click landed inside a pinned note. */
export function caretIndexInField(field: HTMLTextAreaElement | HTMLInputElement, point: CaretPoint): number | null {
  const doc = field.ownerDocument as CaretHost | null;
  if (!doc) return null;
  const position = doc.caretPositionFromPoint?.(point.x, point.y);
  const fromPosition = indexFrom(field, position?.offsetNode ?? null, position?.offset ?? 0);
  if (fromPosition !== null) return fromPosition;
  const range = doc.caretRangeFromPoint?.(point.x, point.y);
  if (!range) return null;
  return indexFrom(field, range.startContainer, range.startOffset);
}
