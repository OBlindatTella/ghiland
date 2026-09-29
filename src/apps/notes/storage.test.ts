import { describe, expect, it } from 'vitest';
import { renderLightMarkdown } from './markdown';
import { guardNotes, limitNoteText, NOTES_MAX_CHARS, NOTES_WARN_AT, noteNearingLimit, packNotes, unpackNotes } from './storage';

describe('notes storage', () => {
  it('round-trips notes and refuses an oversized payload', () => {
    const notes = [{ id: '1', title: 'Sea', body: 'q and spaces', updatedAt: 1 }];
    expect(unpackNotes(packNotes(notes))).toEqual(notes);
    expect(unpackNotes('not json')).toEqual([]);
    expect(guardNotes(packNotes(notes))).toBe(true);
    const limited = limitNoteText('x'.repeat(NOTES_MAX_CHARS + 40));
    expect(limited.clipped).toBe(true);
    expect(limited.text.length).toBe(NOTES_MAX_CHARS);
    expect(noteNearingLimit('x'.repeat(NOTES_WARN_AT))).toBe(true);
    expect(noteNearingLimit('short')).toBe(false);
  });

  it('renders a little markdown without letting HTML through', () => {
    expect(renderLightMarkdown('**q** and *space*\n<script>')).toBe(
      '<strong>q</strong> and <em>space</em><br>&lt;script&gt;',
    );
  });
});
