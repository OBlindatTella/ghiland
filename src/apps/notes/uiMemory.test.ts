import { describe, expect, it } from 'vitest';
import { preferredNoteId, readNotesUi, writeNotesUi } from '@/apps/notes/uiMemory';

describe('notes ui memory', () => {
  it('keeps the selected note across a remount of the same window', () => {
    writeNotesUi('win-1', {
      selectedId: 'second',
      preview: true,
      scrollTop: 40,
      selectionStart: 3,
      selectionEnd: 8,
    });
    expect(preferredNoteId(['first', 'second'], readNotesUi('win-1')?.selectedId ?? null)).toBe('second');
    expect(readNotesUi('win-1')).toMatchObject({ preview: true, scrollTop: 40, selectionStart: 3, selectionEnd: 8 });
    expect(preferredNoteId(['first'], 'missing')).toBe('first');
  });
});
