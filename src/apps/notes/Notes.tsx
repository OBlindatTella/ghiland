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
  saveNotes,
  startNotesSession,
  subscribeNotesRole,
  claimNotesHere,
  type Note,
} from './storage';
import { applyTextEdit, BODY_WINDOW, deleteText, windowFor } from './bodyWindow';
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
  const caretRef = useRef<{ id: string; start: number; end: number } | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const selectedRef = useRef(selected);
  const previewRef = useRef(preview);
  const restoreRef = useRef(remembered);
  const saveTimer = useRef(0);
  const statusText = useRef('');
  const longRef = useRef(false);
  const anchorRef = useRef(0);

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
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (!ready.current) return;
      void saveNotes(notesRef.current).then((result) => {
        if (result === 'ok') showStatus('Saved');
        else if (result === 'blocked') setProblem('blocked');
        else if (result === 'readonly') showStatus('');
        else showStatus('This note could not be saved.');
      });
    }, 300);
  };

  useEffect(() => {
    selectedRef.current = selected;
    previewRef.current = preview;
    writeNotesUi(windowId, {
      selectedId: selected,
      preview,
      scrollTop: bodyRef.current?.scrollTop ?? remembered?.scrollTop ?? 0,
      selectionStart: bodyRef.current ? anchorRef.current + bodyRef.current.selectionStart : remembered?.selectionStart ?? 0,
      selectionEnd: bodyRef.current ? anchorRef.current + bodyRef.current.selectionEnd : remembered?.selectionEnd ?? 0,
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

  const paintBody = (field: HTMLTextAreaElement, full: string, caret: number) => {
    const view = windowFor(full, caret);
    anchorRef.current = view.anchor;
    if (field.value !== view.slice) field.value = view.slice;
    field.setSelectionRange(view.local, view.local);
  };

  useLayoutEffect(() => {
    const field = bodyRef.current;
    if (!field || !current) return;
    if (field.dataset.note !== current.id) {
      const body = notesRef.current.find((note) => note.id === current.id)?.body ?? '';
      const restore = restoreRef.current;
      const caret = restore?.selectedId === current.id ? restore.selectionStart : body.length;
      paintBody(field, body, caret);
      field.dataset.note = current.id;
      if (restore?.selectedId === current.id) {
        field.scrollTop = restore.scrollTop;
        if (restore.selectionEnd !== restore.selectionStart && body.length <= BODY_WINDOW) {
          field.setSelectionRange(restore.selectionStart, restore.selectionEnd);
        }
        restoreRef.current = null;
      }
      if (document.activeElement !== field) field.focus({ preventScroll: true });
    }
    const pending = caretRef.current;
    if (pending && pending.id === current.id) {
      const body = notesRef.current.find((note) => note.id === current.id)?.body ?? field.value;
      paintBody(field, body, pending.start);
      caretRef.current = null;
    }
  }, [current]);

  const editRef = useRef<(event: Event) => void>(() => {});

  useEffect(() => {
    editRef.current = (event) => {
      if (!(event instanceof InputEvent) || notesRole() !== 'writer') return;
      const field = bodyRef.current;
      const live = notesRef.current.find((note) => note.id === selectedRef.current);
      if (!field || !live || field.readOnly) return;
      const localStart = field.selectionStart ?? 0;
      const localEnd = field.selectionEnd ?? localStart;
      selectionRef.current = { start: localStart, end: localEnd };
      const stored = live.body;
      const windowed = stored.length > BODY_WINDOW || anchorRef.current !== 0;
      const full = windowed ? stored : field.value;
      const start = (windowed ? anchorRef.current : 0) + localStart;
      const end = (windowed ? anchorRef.current : 0) + localEnd;
      const inserting = event.inputType.startsWith('insert');
      const deleting = event.inputType.startsWith('delete');
      const incoming = event.data ?? '';
      const wouldWindow = full.length - (end - start) + incoming.length > BODY_WINDOW;
      if (!windowed && !wouldWindow) {
        if (!inserting || incoming.length === 0) return;
        const room = NOTES_MAX_CHARS - (field.value.length - (localEnd - localStart));
        if (room >= incoming.length) return;
        event.preventDefault();
        if (room > 0) {
          let piece = incoming.slice(0, room);
          const code = piece.charCodeAt(piece.length - 1);
          if (code >= 0xd800 && code <= 0xdbff) piece = piece.slice(0, -1);
          field.setRangeText(piece, localStart, localEnd, 'end');
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
        showStatus("The rest of that paste didn't fit.");
        return;
      }
      if (!inserting && !deleting) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      const edited = inserting
        ? applyTextEdit(full, start, end, incoming, NOTES_MAX_CHARS)
        : { ...deleteText(full, start, end, event.inputType === 'deleteContentForward' ? 'forward' : 'backward'), clipped: false };
      if (edited.text === full) {
        if (inserting && incoming.length > 0) showStatus("The rest of that paste didn't fit.");
        return;
      }
      const next = notesRef.current.map((note) =>
        note.id === live.id ? { ...note, body: edited.text, updatedAt: Date.now() } : note,
      );
      notesRef.current = next;
      rememberNotes(next);
      scheduleSave();
      markLength(edited.text);
      paintBody(field, edited.text, edited.caret);
      if (edited.clipped) showStatus("The rest of that paste didn't fit.");
    };
  });

  useEffect(() => {
    const field = bodyRef.current;
    if (!field) return;
    const onBefore = (event: Event) => editRef.current(event);
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
      const limited = trimInsertion(
        live.body,
        nextPatch.body,
        caret ?? nextPatch.body.length,
        NOTES_MAX_CHARS,
        selectionRef.current,
      );
      nextPatch.body = limited.text;
      clipped = clipped || limited.clipped;
      markLength(limited.text);
      if (limited.clipped || limited.text.length > BODY_WINDOW) {
        const field = bodyRef.current;
        if (field) paintBody(field, limited.text, limited.caret);
      }
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
              defaultValue=""
              readOnly={role !== 'writer' || problem !== null}
              onKeyDown={(event) => {
                const live = notesRef.current.find((note) => note.id === selectedRef.current);
                if (!live || live.body.length <= BODY_WINDOW) return;
                const field = event.currentTarget;
                const local = field.selectionStart ?? 0;
                const caret = anchorRef.current + local;
                if ((event.key === 'Home' || event.key === 'End') && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  paintBody(field, live.body, event.key === 'Home' ? 0 : live.body.length);
                } else if (event.key === 'ArrowLeft' && local === 0 && anchorRef.current > 0 && field.selectionEnd === local) {
                  event.preventDefault();
                  paintBody(field, live.body, Math.max(0, caret - 1));
                } else if (
                  event.key === 'ArrowRight' &&
                  local === field.value.length &&
                  anchorRef.current + field.value.length < live.body.length &&
                  field.selectionEnd === local
                ) {
                  event.preventDefault();
                  paintBody(field, live.body, Math.min(live.body.length, caret + 1));
                }
              }}
              onSelect={(event) => {
                const start = anchorRef.current + event.currentTarget.selectionStart;
                const end = anchorRef.current + event.currentTarget.selectionEnd;
                selectionRef.current = { start, end };
                writeNotesUi(windowId, {
                  selectedId: selectedRef.current,
                  preview: previewRef.current,
                  scrollTop: event.currentTarget.scrollTop,
                  selectionStart: start,
                  selectionEnd: end,
                });
              }}
              onScroll={(event) => {
                writeNotesUi(windowId, {
                  selectedId: selectedRef.current,
                  preview: previewRef.current,
                  scrollTop: event.currentTarget.scrollTop,
                  selectionStart: anchorRef.current + event.currentTarget.selectionStart,
                  selectionEnd: anchorRef.current + event.currentTarget.selectionEnd,
                });
              }}
              onChange={(event) => {
                const stored = notesRef.current.find((note) => note.id === selectedRef.current)?.body ?? '';
                if (stored.length > BODY_WINDOW && event.target.value.length <= BODY_WINDOW) return;
                const caret = anchorRef.current + (event.target.selectionStart ?? event.target.value.length);
                update({ body: event.target.value }, caret);
              }}
            />
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}
