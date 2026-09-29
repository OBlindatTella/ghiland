import { describe, expect, it } from 'vitest';
import { renderLightMarkdown } from './markdown';
import {
  guardNotes,
  limitNoteText,
  NOTES_MAX_CHARS,
  NOTES_WARN_AT,
  noteNearingLimit,
  packNotes,
  parseIndexValue,
  parseLegacyPack,
  parseStoredNote,
  quarantineKey,
  unpackNotes,
} from './storage';

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

  it('migrates a legacy array and quarantines a corrupt record without treating it as empty notes', () => {
    const legacy = packNotes([{ id: '1', title: 'Sea', body: 'grey', updatedAt: 4 }]);
    expect(parseLegacyPack(legacy)).toEqual({
      kind: 'notes',
      notes: [{ id: '1', title: 'Sea', body: 'grey', updatedAt: 4 }],
    });
    expect(parseLegacyPack('{"version":1,"notes":[')).toEqual({ kind: 'corrupt' });
    expect(parseStoredNote({ version: 1, id: '1', title: 'Sea', body: 'grey', updatedAt: 4 })).toEqual({
      kind: 'note',
      version: 1,
      note: { id: '1', title: 'Sea', body: 'grey', updatedAt: 4 },
    });
    expect(parseStoredNote('{"version":1')).toEqual({ kind: 'corrupt' });
    expect(parseIndexValue({ version: 1, ids: ['1'] })).toEqual({ kind: 'ids', ids: ['1'] });
    expect(parseIndexValue({ ids: 'nope' })).toEqual({ kind: 'corrupt' });
    expect(quarantineKey('ghiland:app:notes:note:1', 9)).toBe('ghiland:app:notes:quarantine:9:ghiland:app:notes:note:1');
    expect(unpackNotes('not json')).toEqual([]);
  });

  it('renders a little markdown without letting HTML through', () => {
    expect(renderLightMarkdown('**q** and *space*\n<script>')).toBe(
      '<strong>q</strong> and <em>space</em><br>&lt;script&gt;',
    );
  });
});
