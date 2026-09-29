'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AppProps } from '@/contracts/app';
import { renderLightMarkdown } from './markdown';
import {
  flushNotes,
  loadNotes,
  trimInsertion,
  NOTES_MAX_CHARS,
  noteNearingLimit,
  notesLeaderNotice,
  notesRole,
  rememberNotes,
  notesSaveDelay,
  saveNotes,
  startNotesSession,
  subscribeNotesRole,
  claimNotesHere,
  type Note,
} from './storage';
import { preferredNoteId, readNotesUi, writeNotesUi } from './uiMemory';

function freshNote(): Note {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
    title: 'Untitled',
    body: '',
    updatedAt: Date.now(),
  };
}

export default function Notes({ windowId, host }: AppProps) {
  const remembered = readNotesUi(windowId);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<string | null>(remembered?.selectedId ?? null);
  const [preview, setPreview] = useState(remembered?.preview ?? false);
  const [status, setStatus] = useState('');
  const [longNote, setLongNote] = useState(false);
  const [role, setRole] = useState(notesRole);
  const [problem, setProblem] = useState<'blocked' | 'unavailable' | null>(null);
  const [notice, setNotice] = useState('');
  const [leaderNotice, setLeaderNotice] = useState(notesLeaderNotice);
  const [sessionReady, setSessionReady] = useState(false);
  const ready = useRef(false);
  const notesRef = useRef(notes);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selectedRef = useRef(selected);
  const previewRef = useRef(preview);
  const restoreRef = useRef(remembered);
  const saveTimer = useRef(0);
  const saveArmed = useRef(0);
  const statusText = useRef('');
  const longRef = useRef(false);

  const showStatus = (text: string) => {
    if (statusText.current === text) return;
    statusText.current = text;
    setStatus(text);
  };

  const markLength = (body: string) => {
    const next = noteNearingLimit(body);
    if (longRef.current === next) return;
    longRef.current = next;
    setLongNote(next);
  };

  const scheduleSave = () => {
    const now = Date.now();
    if (saveArmed.current === 0) saveArmed.current = now;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveArmed.current = 0;
      if (!ready.current) return;
      void saveNotes(notesRef.current).then((result) => {
        if (result === 'ok') showStatus('Saved');
        else if (result === 'blocked') setProblem('blocked');
        else if (result === 'readonly') showStatus('');
        else showStatus('This note could not be saved.');
      });
    }, notesSaveDelay(now - saveArmed.current));
  };

  useEffect(() => {
    selectedRef.current = selected;
    previewRef.current = preview;
    writeNotesUi(windowId, {
      selectedId: selected,
      preview,
      scrollTop: bodyRef.current?.scrollTop ?? remembered?.scrollTop ?? 0,
      selectionStart: bodyRef.current?.selectionStart ?? remembered?.selectionStart ?? 0,
      selectionEnd: bodyRef.current?.selectionEnd ?? remembered?.selectionEnd ?? 0,
    });
  }, [windowId, selected, preview, remembered]);

  useEffect(
    () =>
      subscribeNotesRole((next) => {
        setRole(next);
        setLeaderNotice(notesLeaderNotice());
      }),
    [],
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      const claimed = await startNotesSession();
      if (!live) return;
      setRole(claimed);
      setLeaderNotice(notesLeaderNotice());
      setSessionReady(true);
      const loaded = await loadNotes();
      if (!live) return;
      if (loaded.status !== 'ok') {
        setProblem(loaded.status);
        return;
      }
      const next = loaded.notes.length > 0 ? loaded.notes : [freshNote()];
      notesRef.current = next;
      const selectedId = preferredNoteId(next.map((note) => note.id), readNotesUi(windowId)?.selectedId ?? null);
      markLength(next.find((note) => note.id === selectedId)?.body ?? next[0]?.body ?? '');
      setNotes(next);
      setSelected(selectedId);
      if (loaded.indexRebuilt) setNotice('The notes list was repaired.');
      else if (loaded.quarantined > 0) setNotice('A saved note could not be read. It was set aside.');
      ready.current = claimed === 'writer';
      if (ready.current) rememberNotes(next);
    })();
    return () => {
      live = false;
    };
  }, [windowId]);

  useEffect(() => {
    const flush = () => {
      if (ready.current) void flushNotes();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (ready.current) void saveNotes(notesRef.current);
    };
  }, []);

  const current = notes.find((note) => note.id === selected) ?? notes[0];

  useLayoutEffect(() => {
    const field = bodyRef.current;
    if (!field || !current) return;
    const restore = restoreRef.current;
    if (restore?.selectedId === current.id) {
      field.scrollTop = restore.scrollTop;
      const start = Math.min(restore.selectionStart, field.value.length);
      const end = Math.min(restore.selectionEnd, field.value.length);
      field.setSelectionRange(start, end);
      restoreRef.current = null;
    }
  }, [current]);

  const commitBody = (body: string) => {
    const live = notesRef.current.find((note) => note.id === selectedRef.current);
    if (!live || live.body === body) return;
    const next = notesRef.current.map((note) => (note.id === live.id ? { ...note, body, updatedAt: Date.now() } : note));
    notesRef.current = next;
    rememberNotes(next);
    scheduleSave();
    markLength(body);
  };

  useEffect(() => {
    const field = bodyRef.current;
    if (!field) return;
    const onBefore = (event: Event) => {
      if (!(event instanceof InputEvent) || notesRole() !== 'writer' || field.readOnly) return;
      if (!event.inputType.startsWith('insert')) return;
      if (event.inputType === 'insertCompositionText') return;
      const start = field.selectionStart ?? 0;
      const end = field.selectionEnd ?? start;
      const incoming =
        event.data ?? (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph' ? '\n' : '');
      if (!incoming) return;
      const room = NOTES_MAX_CHARS - (field.value.length - (end - start));
      if (room >= incoming.length) return;
      event.preventDefault();
      if (room > 0) {
        let piece = incoming.slice(0, room);
        const code = piece.charCodeAt(piece.length - 1);
        if (code >= 0xd800 && code <= 0xdbff) piece = piece.slice(0, -1);
        if (piece.length > 0) field.setRangeText(piece, start, end, 'end');
      }
      showStatus("The rest of that paste didn't fit.");
    };
    field.addEventListener('beforeinput', onBefore);
    return () => field.removeEventListener('beforeinput', onBefore);
  }, [current?.id, preview]);

  useEffect(() => {
    if (current) host.setTitle(current.title || 'Notes');
  }, [current, host]);

  const update = (patch: Partial<Note>, caret?: number) => {
    const live = notesRef.current.find((note) => note.id === selectedRef.current) ?? current;
    if (!live || role !== 'writer' || problem) return;
    let clipped = false;
    const nextPatch = { ...patch };
    if (nextPatch.title !== undefined) {
      const limited = trimInsertion(live.title, nextPatch.title, caret ?? nextPatch.title.length);
      nextPatch.title = limited.text;
      clipped = clipped || limited.clipped;
    }
    if (nextPatch.body !== undefined) {
      const limited = trimInsertion(live.body, nextPatch.body, caret ?? nextPatch.body.length, NOTES_MAX_CHARS);
      nextPatch.body = limited.text;
      clipped = clipped || limited.clipped;
      markLength(limited.text);
    }
    if (clipped) showStatus("The rest of that paste didn't fit.");
    const next = notesRef.current.map((note) =>
      note.id === live.id ? { ...note, ...nextPatch, updatedAt: Date.now() } : note,
    );
    notesRef.current = next;
    rememberNotes(next);
    scheduleSave();
    if (nextPatch.title === undefined) return;
    setNotes(next);
  };

  const takeOver = () => {
    void (async () => {
      const claimed = await claimNotesHere();
      setRole(claimed);
      if (claimed !== 'writer') return;
      const loaded = await loadNotes();
      if (loaded.status !== 'ok') {
        setProblem(loaded.status);
        return;
      }
      const next = loaded.notes.length > 0 ? loaded.notes : [freshNote()];
      notesRef.current = next;
      const selectedId = preferredNoteId(next.map((note) => note.id), readNotesUi(windowId)?.selectedId ?? null);
      markLength(next.find((note) => note.id === selectedId)?.body ?? next[0]?.body ?? '');
      setNotes(next);
      setSelected(selectedId);
      ready.current = true;
      setProblem(null);
      rememberNotes(next);
      scheduleSave();
    })();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {problem === 'blocked' ? (
        <p data-testid="notes-blocked" className="border-b border-white/10 px-4 py-3 text-[13px] leading-5 text-[#f2f0eb]/80">
          Site data is blocked in this browser.
        </p>
      ) : null}
      {problem === 'unavailable' ? (
        <p className="border-b border-white/10 px-4 py-3 text-[13px] leading-5 text-[#f2f0eb]/80">
          Notes could not be read. Nothing was overwritten.
        </p>
      ) : null}
      {leaderNotice ? (
        <p data-testid="notes-leader-notice" className="border-b border-white/10 px-4 py-3 text-[13px] leading-5 text-[#f2f0eb]/80">
          This browser cannot keep Notes to one tab.
        </p>
      ) : null}
      {notice ? (
        <p data-testid="notes-notice" className="border-b border-white/10 px-4 py-3 text-[13px] leading-5 text-[#f2f0eb]/80">
          {notice}
        </p>
      ) : null}
      {role === 'reader' && sessionReady && !problem ? (
        <div data-testid="notes-other-tab" className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-[13px] leading-5">
          <span>Ghiland is open in another tab</span>
          <button type="button" className="rounded-[6px] border border-white/10 px-2 py-1" onClick={takeOver}>
            Use here
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
      <aside className="flex w-36 shrink-0 flex-col border-r border-white/10">
        <button
          type="button"
          data-testid="notes-new"
          className="h-8 border-b border-white/10 text-[12px] leading-4 text-[#f2f0eb]/64"
          disabled={role !== 'writer' || problem !== null}
          onClick={() => {
            if (role !== 'writer' || problem) return;
            const note = freshNote();
            const next = [note, ...notesRef.current];
            notesRef.current = next;
            markLength('');
            setNotes(next);
            setSelected(note.id);
          }}
        >
          New
        </button>
        <ul className="min-h-0 flex-1 overflow-y-auto" data-testid="notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className="w-full truncate px-3 py-2 text-left text-[13px] leading-5"
                style={{ background: note.id === current?.id ? 'rgba(134,189,178,0.16)' : 'transparent' }}
                onClick={() => {
                  markLength(notesRef.current.find((item) => item.id === note.id)?.body ?? note.body);
                  setSelected(note.id);
                }}
              >
                {note.title || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {current ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            data-testid="notes-title"
            aria-label="Title"
            className="h-10 border-b border-white/10 bg-transparent px-4 text-[15px] leading-6 outline-none"
            value={current.title}
            readOnly={role !== 'writer' || problem !== null}
            onChange={(event) => update({ title: event.target.value }, event.target.selectionStart ?? event.target.value.length)}
          />
          <div className="flex items-center justify-between px-4 pt-2 text-[12px] leading-4 text-[#f2f0eb]/64">
            <span className="flex min-w-0 flex-col">
              {longNote ? <span>This note is getting long.</span> : null}
              <span>{status}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (!preview) setNotes(notesRef.current);
                setPreview((value) => !value);
              }}
            >
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[15px] leading-6"
              dangerouslySetInnerHTML={{ __html: renderLightMarkdown(current.body) }}
            />
          ) : (
            <textarea
              ref={bodyRef}
              key={current.id}
              data-testid="notes-body"
              aria-label="Note"
              className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-6 outline-none"
              defaultValue={notesRef.current.find((note) => note.id === current.id)?.body ?? current.body}
              readOnly={role !== 'writer' || problem !== null}
              onSelect={(event) => {
                writeNotesUi(windowId, {
                  selectedId: selectedRef.current,
                  preview: previewRef.current,
                  scrollTop: event.currentTarget.scrollTop,
                  selectionStart: event.currentTarget.selectionStart,
                  selectionEnd: event.currentTarget.selectionEnd,
                });
              }}
              onScroll={(event) => {
                writeNotesUi(windowId, {
                  selectedId: selectedRef.current,
                  preview: previewRef.current,
                  scrollTop: event.currentTarget.scrollTop,
                  selectionStart: event.currentTarget.selectionStart,
                  selectionEnd: event.currentTarget.selectionEnd,
                });
              }}
              onInput={(event) => commitBody(event.currentTarget.value)}
            />
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}
