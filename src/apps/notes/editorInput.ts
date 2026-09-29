import { NOTES_MAX_CHARS, trimInsertion } from './storage';

export interface KeystrokeMark {
  dirty: boolean;
  /** Tracked length. The keystroke path never replaces this by reading the note. */
  length: number;
}

export interface NoteInputEvent {
  nativeEvent?: { inputType?: string };
  currentTarget?: {
    value: string;
    selectionStart: number | null;
    setSelectionRange?: (start: number, end: number) => void;
  };
}

/**
 * Per-keystroke decision. A normal insert does not read or copy the note.
 * Undo and redo are the only input types that need the caret trim.
 */
export function handleNoteInputEvent(mark: KeystrokeMark, event?: { nativeEvent?: { inputType?: string } }): KeystrokeMark & { correct: boolean } {
  const inputType = event?.nativeEvent?.inputType;
  if (inputType === 'historyUndo' || inputType === 'historyRedo') {
    return { dirty: true, length: mark.length, correct: true };
  }
  if (mark.dirty) return { dirty: true, length: mark.length, correct: false };
  return { dirty: true, length: mark.length, correct: false };
}

/**
 * Input handler used by the textarea. `.value` is touched only for undo/redo.
 * Everything else returns a dirty mark and leaves the string alone.
 */
export function dispatchNoteInput(
  mark: KeystrokeMark,
  event: NoteInputEvent,
  trim: (value: string, caret: number) => { text: string; caret: number; clipped: boolean } = trimOverflowAtCaret,
): { mark: KeystrokeMark; value?: string; caret?: number; clipped: boolean } {
  const next = handleNoteInputEvent(mark, event);
  if (!next.correct || !event.currentTarget) return { mark: { dirty: true, length: mark.length }, clipped: false };
  const caret = event.currentTarget.selectionStart ?? 0;
  const trimmed = trim(event.currentTarget.value, caret);
  return {
    mark: { dirty: true, length: trimmed.text.length },
    value: trimmed.text,
    caret: trimmed.caret,
    clipped: trimmed.clipped,
  };
}

export function insertionRoom(length: number, start: number, end: number, max = NOTES_MAX_CHARS): number {
  const span = Math.max(0, end - start);
  return max - (length - span);
}

function withoutSplitPair(text: string): string {
  if (text.length === 0) return text;
  const last = text.charCodeAt(text.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) return text.slice(0, -1);
  return text;
}

/** Shorten inserted text to `room` code units without cutting a grapheme or a surrogate pair. */
export function clipIncomingText(incoming: string, room: number): { text: string; clipped: boolean } {
  if (room >= incoming.length) return { text: incoming, clipped: false };
  if (room <= 0) return { text: '', clipped: incoming.length > 0 };
  let end = Math.max(0, room);
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    end = 0;
    for (const part of segmenter.segment(incoming)) {
      const next = part.index + part.segment.length;
      if (next > room) break;
      end = next;
    }
  }
  const text = withoutSplitPair(incoming.slice(0, end));
  return { text, clipped: text.length < incoming.length };
}

export function pastedText(inputType: string, data: string | null, transferText: string | null): string {
  if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') return data || '\n';
  if (data) return data;
  if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') return transferText ?? '';
  return '';
}

export interface BeforeInputPlan {
  prevent: boolean;
  text: string;
  clipped: boolean;
  nextLength: number | null;
  dirty: boolean;
}

/**
 * Limit check for one beforeinput. Uses the tracked length, the selection, and the
 * inserted text. It does not receive the note body.
 */
export function planBeforeInput(
  length: number,
  start: number,
  end: number,
  inputType: string,
  data: string | null,
  transferText: string | null,
): BeforeInputPlan {
  if (inputType === 'insertCompositionText') {
    return { prevent: false, text: '', clipped: false, nextLength: null, dirty: false };
  }
  if (inputType.startsWith('delete')) {
    if (inputType === 'deleteWordBackward' || inputType === 'deleteWordForward') {
      return { prevent: false, text: '', clipped: false, nextLength: null, dirty: false };
    }
    const span = Math.max(0, end - start);
    return {
      prevent: false,
      text: '',
      clipped: false,
      nextLength: Math.max(0, length - (span > 0 ? span : 1)),
      dirty: false,
    };
  }
  if (!inputType.startsWith('insert')) {
    return { prevent: false, text: '', clipped: false, nextLength: null, dirty: false };
  }
  const incoming = pastedText(inputType, data, transferText);
  if (!incoming) return { prevent: false, text: '', clipped: false, nextLength: null, dirty: false };
  const span = Math.max(0, end - start);
  const room = insertionRoom(length, start, end);
  if (room >= incoming.length) {
    return { prevent: false, text: incoming, clipped: false, nextLength: length - span + incoming.length, dirty: false };
  }
  const clipped = clipIncomingText(incoming, Math.max(0, room));
  return {
    prevent: true,
    text: clipped.text,
    clipped: true,
    nextLength: length - span + clipped.text.length,
    dirty: clipped.text.length > 0,
  };
}

export interface ClippedField {
  value: string;
  setSelectionRange?: (start: number, end: number) => void;
  setRangeText?: (text: string, start: number, end: number, mode: 'end') => void;
  dispatchEvent?: (event: Event) => boolean;
  ownerDocument?: { execCommand?: (command: string, showUi: boolean, value: string) => boolean };
}

/** `setRangeText` does not fire `input` and is not undoable. Prefer `insertText`, and always mark dirty. */
export function insertClippedText(field: ClippedField, start: number, end: number, text: string): { dirty: true } {
  field.setSelectionRange?.(start, end);
  const command = field.ownerDocument?.execCommand;
  if (command?.('insertText', false, text)) return { dirty: true };
  if (field.setRangeText) field.setRangeText(text, start, end, 'end');
  else field.value = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
  if (field.dispatchEvent) {
    const event =
      typeof InputEvent === 'function'
        ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
        : ({ type: 'input', bubbles: true } as Event);
    field.dispatchEvent(event);
  }
  return { dirty: true };
}

/** Remove the overflow next to the caret so a limit trim never deletes the tail. */
export function trimOverflowAtCaret(
  value: string,
  caret: number,
  max = NOTES_MAX_CHARS,
): { text: string; caret: number; clipped: boolean } {
  if (value.length <= max) return { text: value, caret, clipped: false };
  const at = Math.max(0, Math.min(caret, value.length));
  const over = value.length - max;
  let start = Math.max(0, at - over);
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let boundary = 0;
    for (const part of segmenter.segment(value)) {
      if (part.index > start) break;
      boundary = part.index;
    }
    start = boundary;
  }
  const code = value.charCodeAt(start);
  if (code >= 0xdc00 && code <= 0xdfff && start > 0) start -= 1;
  return trimInsertion(`${value.slice(0, start)}${value.slice(at)}`, value, at, max, { start, end: start });
}

/** A dirty uncontrolled textarea ignores a new defaultValue. Assign the loaded body before accepting input. */
export function assignNoteBody(field: { value: string }, body: string): void {
  if (field.value !== body) field.value = body;
}
