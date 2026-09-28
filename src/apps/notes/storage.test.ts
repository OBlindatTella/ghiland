import { describe, expect, it } from 'vitest';
import { renderLightMarkdown } from './markdown';
import { guardNotes, NOTES_MAX_CHARS, packNotes, unpackNotes } from './storage';

describe('notes storage', () => {
  it('round-trips notes and refuses an oversized payload', () => {
    const notes = [{ id: '1', title: 'Sea', body: 'q and spaces', updatedAt: 1 }];
    expect(unpackNotes(packNotes(notes))).toEqual(notes);
    expect(unpackNotes('not json')).toEqual([]);
    expect(guardNotes(packNotes(notes))).toBe(true);
    expect(guardNotes('x'.repeat(NOTES_MAX_CHARS + 1))).toBe(false);
  });

  it('renders a little markdown without letting HTML through', () => {
    expect(renderLightMarkdown('**q** and *space*\n<script>')).toBe(
      '<strong>q</strong> and <em>space</em><br>&lt;script&gt;',
    );
  });
});
