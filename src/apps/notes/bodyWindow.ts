/** Visible slice. A multi-megabyte textarea drops a key-to-glyph well past 50 ms. */
export const BODY_WINDOW = 8_000;

export function windowFor(
  full: string,
  caret: number,
  size = BODY_WINDOW,
): { anchor: number; slice: string; local: number } {
  const clamped = Math.max(0, Math.min(caret, full.length));
  if (full.length <= size) return { anchor: 0, slice: full, local: clamped };
  const anchor = Math.max(0, Math.min(clamped - Math.floor(size / 2), full.length - size));
  return { anchor, slice: full.slice(anchor, anchor + size), local: clamped - anchor };
}

function withoutSplitPair(text: string): string {
  if (text.length === 0) return text;
  const code = text.charCodeAt(text.length - 1);
  return code >= 0xd800 && code <= 0xdbff ? text.slice(0, -1) : text;
}

/** Edit the full note. Returns the same string when the insert does not fit. */
export function applyTextEdit(
  full: string,
  start: number,
  end: number,
  insert: string,
  max: number,
): { text: string; caret: number; clipped: boolean } {
  const from = Math.max(0, Math.min(start, full.length));
  const to = Math.max(from, Math.min(end, full.length));
  const room = max - (full.length - (to - from));
  if (room <= 0) return { text: full, caret: from, clipped: insert.length > 0 };
  const piece = withoutSplitPair(insert.slice(0, room));
  if (piece.length === 0 && from === to) return { text: full, caret: from, clipped: insert.length > 0 };
  const text = `${full.slice(0, from)}${piece}${full.slice(to)}`;
  return { text, caret: from + piece.length, clipped: piece.length < insert.length };
}

export function deleteText(
  full: string,
  start: number,
  end: number,
  direction: 'backward' | 'forward',
): { text: string; caret: number } {
  let from = Math.max(0, Math.min(start, full.length));
  let to = Math.max(from, Math.min(end, full.length));
  if (from === to && direction === 'backward') from = step(full, from, -1);
  if (from === to && direction === 'forward') to = step(full, to, 1);
  return { text: `${full.slice(0, from)}${full.slice(to)}`, caret: from };
}

function step(text: string, index: number, delta: number): number {
  if (delta < 0) {
    if (index <= 0) return 0;
    const code = text.charCodeAt(index - 1);
    return code >= 0xdc00 && code <= 0xdfff && index >= 2 ? index - 2 : index - 1;
  }
  if (index >= text.length) return text.length;
  const code = text.charCodeAt(index);
  return code >= 0xd800 && code <= 0xdbff && index + 1 < text.length ? index + 2 : index + 1;
}
