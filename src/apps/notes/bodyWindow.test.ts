import { describe, expect, it } from 'vitest';
import { applyTextEdit, deleteText, windowFor } from './bodyWindow';

describe('windowed note body', () => {
  it('keeps a short note intact and windows a long one around the caret', () => {
    expect(windowFor('hello', 2)).toEqual({ anchor: 0, slice: 'hello', local: 2 });
    const full = `${'n'.repeat(20_000)}END`;
    const view = windowFor(full, 10);
    expect(view.anchor).toBe(0);
    expect(view.local).toBe(10);
    expect(view.slice.endsWith('n')).toBe(true);
    const tail = windowFor(full, full.length);
    expect(tail.slice.endsWith('END')).toBe(true);
    expect(tail.anchor + tail.local).toBe(full.length);
  });

  it('inserts in the middle of a full note and leaves the tail', () => {
    const full = `${'a'.repeat(2_000_000 - 3)}END`;
    const edited = applyTextEdit(full, 10, 10, 'Q', 2_000_000);
    expect(edited.text).toBe(full);
    expect(edited.caret).toBe(10);
    expect(edited.clipped).toBe(true);
    const room = applyTextEdit(`${'a'.repeat(20)}END`, 10, 10, 'Q', 2_000_000);
    expect(room.text[10]).toBe('Q');
    expect(room.text.endsWith('END')).toBe(true);
    expect(room.caret).toBe(11);
  });

  it('does not keep half a surrogate pair', () => {
    const full = 'a'.repeat(5);
    const edited = applyTextEdit(full, 5, 5, '😀', 6);
    expect(edited.text).toBe(full);
    expect(edited.clipped).toBe(true);
  });

  it('deletes one character backward without splitting a pair', () => {
    const edited = deleteText('ab😀cd', 4, 4, 'backward');
    expect(edited.text).toBe('abcd');
    expect(edited.caret).toBe(2);
  });
});
