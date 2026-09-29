import { describe, expect, it } from 'vitest';
import { NOTES_MAX_CHARS } from './storage';
import {
  clipIncomingText,
  dispatchNoteInput,
  insertClippedText,
  planBeforeInput,
  trimOverflowAtCaret,
} from './editorInput';

describe('note keystrokes', () => {
  it('keeps the input handler cost flat from 1k to 1M characters', () => {
    const run = (length: number) => {
      let reads = 0;
      const event = {
        nativeEvent: { inputType: 'insertText' },
        currentTarget: {
          get value() {
            reads += 1;
            let n = 0;
            for (let i = 0; i < length; i += 1) n = (n + (i & 255)) | 0;
            return String(n);
          },
          selectionStart: length,
        },
      };
      const start = performance.now();
      for (let i = 0; i < 40; i += 1) {
        dispatchNoteInput({ dirty: false, length }, event);
      }
      return { ms: performance.now() - start, reads };
    };
    const small = run(1_000);
    const large = run(1_000_000);
    console.info(
      `keystroke-handler 1k=${small.ms.toFixed(3)}ms 1M=${large.ms.toFixed(3)}ms reads=${small.reads}/${large.reads}`,
    );
    expect(small.reads).toBe(0);
    expect(large.reads).toBe(0);
    expect(large.ms).toBeLessThan(Math.max(20, small.ms * 3));
  });

  it('trims undo and IME overflow at the caret and keeps the tail', () => {
    const value = `${'a'.repeat(10)}INSERTED${'b'.repeat(10)}END`;
    const caret = 10 + 'INSERTED'.length;
    const trimmed = trimOverflowAtCaret(value, caret, value.length - 'INSERTED'.length);
    expect(trimmed.clipped).toBe(true);
    expect(trimmed.text.endsWith('END')).toBe(true);
    expect(trimmed.text.includes('INSERTED')).toBe(false);
    const flag = '\u{1F1FA}\u{1F1F8}';
    const clipped = clipIncomingText(`a${flag}`, 2);
    expect(clipped.clipped).toBe(true);
    expect(clipped.text).toBe('a');
  });

  it('clips a paste from dataTransfer, marks it dirty, and does not read the note', () => {
    const within = planBeforeInput(4, 4, 4, 'insertFromPaste', null, 'ok');
    expect(within.prevent).toBe(false);
    expect(within.nextLength).toBe(6);
    const over = planBeforeInput(NOTES_MAX_CHARS - 1, NOTES_MAX_CHARS - 1, NOTES_MAX_CHARS - 1, 'insertFromPaste', null, 'xyz');
    expect(over.prevent).toBe(true);
    expect(over.clipped).toBe(true);
    expect(over.text).toBe('x');
    expect(over.dirty).toBe(true);
    const calls: string[] = [];
    const field = {
      value: 'hello',
      setSelectionRange() {},
      setRangeText(text: string, start: number, end: number) {
        calls.push(`${start}:${end}:${text}`);
        this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
      },
      dispatchEvent() {
        calls.push('input');
        return true;
      },
    };
    expect(insertClippedText(field, 5, 5, '!').dirty).toBe(true);
    expect(field.value).toBe('hello!');
    expect(calls).toContain('input');
  });

  it('reads the note value only when correcting undo', () => {
    let reads = 0;
    const event = {
      nativeEvent: { inputType: 'historyUndo' },
      currentTarget: {
        get value() {
          reads += 1;
          return `${'a'.repeat(8)}ZZEND`;
        },
        selectionStart: 10,
        setSelectionRange() {},
      },
    };
    const mark = dispatchNoteInput({ dirty: false, length: 8 }, event, (value, caret) =>
      trimOverflowAtCaret(value, caret, 10),
    );
    expect(reads).toBe(1);
    expect(mark.clipped).toBe(true);
    expect(mark.value?.endsWith('END')).toBe(true);
  });
});
