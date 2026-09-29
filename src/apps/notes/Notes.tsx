'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { AppProps } from '@/contracts/app';
import { renderLightMarkdown } from './markdown';
import {
  assignNoteBody,
  dispatchNoteInput,
  insertClippedText,
  planBeforeInput,
  trimOverflowAtCaret,
} from './editorInput';
import {
  bindNotesBodyPull,
  claimNotesHere,
  flushNotes,
  loadNotes,
  NOTES_WARN_AT,
  noteTyped,
  notesLeaderNotice,
  notesRole,
  notesSaveDelay,
  rememberNotes,
  saveNotes,
  startNotesSession,
  trimInsertion,
  subscribeNotesHandoff,
  subscribeNotesRole,
  type LoadNotesResult,
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
  const [bodyEpoch, setBodyEpoch] = useState(0);
  const [editEpoch, setEditEpoch] = useState(0);
  const acceptRef = useRef(false);
  const epochRef = useRef(0);
  const notesRef = useRef(notes);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selectedRef = useRef(selected);
  const previewRef = useRef(preview);
  const restoreRef = useRef(remembered);
  const saveTimer = useRef(0);
  const saveArmed = useRef(0);
  const statusText = useRef('');
  const longRef = useRef(false);
  const lengthRef = useRef(0);
  const bodyDirty = useRef(false);
  const pullRef = useRef<() => void>(() => {});

  const showStatus = (text: string) => {
    if (statusText.current === text) return;
    statusText.current = text;
    setStatus(text);
  };

  const markLengthCount = (length: number) => {
    const next = length >= NOTES_WARN_AT;
    if (longRef.current === next) return;
    longRef.current = next;
    setLongNote(next);
  };

  const disarm = () => {
    acceptRef.current = false;
    setEditEpoch(-1);
    window.clearTimeout(saveTimer.current);
    saveArmed.current = 0;
  };

  const bumpEpoch = () => {
    epochRef.current += 1;
    const nextEpoch = epochRef.current;
    setBodyEpoch(nextEpoch);
    setEditEpoch(nextEpoch);
    return nextEpoch;
  };

  const applyLoaded = (next: Note[], selectedId: string | null) => {
    acceptRef.current = false;
    notesRef.current = next;
    const body = next.find((note) => note.id === selectedId)?.body ?? next[0]?.body ?? '';
    lengthRef.current = body.length;
    markLengthCount(body.length);
    bodyDirty.current = false;
    setNotes(next);
    setSelected(selectedId);
    bumpEpoch();
  };

  const pullBody = () => {
    const field = bodyRef.current;
    if (!field || !bodyDirty.current || !acceptRef.current || notesRole() !== 'writer') return;
    const body = field.value;
    bodyDirty.current = false;
    lengthRef.current = body.length;
    markLengthCount(body.length);
    const live = notesRef.current.find((note) => note.id === selectedRef.current);
    if (!live || live.body === body) return;
    const next = notesRef.current.map((note) => (note.id === live.id ? { ...note, body, updatedAt: Date.now() } : note));
    notesRef.current = next;
    rememberNotes(next);
  };

  const scheduleSave = () => {
    if (notesRole() !== 'writer') return;
    const now = Date.now();
    if (saveArmed.current === 0) saveArmed.current = now;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveArmed.current = 0;
      if (!acceptRef.current || notesRole() !== 'writer') return;
      pullBody();
      void saveNotes(notesRef.current).then((result) => {
        if (result === 'ok') showStatus('Saved');
        else if (result === 'blocked') setProblem('blocked');
        else if (result === 'readonly') showStatus('');
        else showStatus('This note could not be saved.');
      });
    }, notesSaveDelay(now - saveArmed.current));
  };

  const showLoadedRef = useRef<(loaded: LoadNotesResult) => void>(() => {});
  const scheduleSaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    pullRef.current = pullBody;
    scheduleSaveRef.current = scheduleSave;
    showLoadedRef.current = (loaded) => {
      if (loaded.status !== 'ok') {
        setProblem(loaded.status);
        return;
      }
      const next = loaded.notes.length > 0 ? loaded.notes : [freshNote()];
      const selectedId = preferredNoteId(next.map((note) => note.id), readNotesUi(windowId)?.selectedId ?? selectedRef.current);
      if (loaded.indexRebuilt) setNotice('The notes list was repaired.');
      else if (loaded.quarantined > 0) setNotice('A saved note could not be read. It was set aside.');
      applyLoaded(next, selectedId);
      setProblem(null);
      if (notesRole() === 'writer') rememberNotes(next);
    };
  });

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
        acceptRef.current = false;
        setEditEpoch(-1);
        if (next !== 'writer') {
          window.clearTimeout(saveTimer.current);
          saveArmed.current = 0;
        }
      }),
    [],
  );

  useEffect(() => bindNotesBodyPull(() => pullRef.current()), []);

  useEffect(() => subscribeNotesHandoff((loaded) => showLoadedRef.current(loaded)), []);

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
      showLoadedRef.current(loaded);
    })();
    return () => {
      live = false;
    };
  }, [windowId]);

  useEffect(() => {
    const flush = () => {
      if (!acceptRef.current || notesRole() !== 'writer') return;
      pullRef.current();
      void flushNotes();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (acceptRef.current && notesRole() === 'writer') {
        pullRef.current();
        void saveNotes(notesRef.current);
      }
    };
  }, []);

  const current = notes.find((note) => note.id === selected) ?? notes[0];

  const writable = role === 'writer' && problem === null && editEpoch === bodyEpoch && bodyEpoch > 0;

  useLayoutEffect(() => {
    acceptRef.current = writable;
    const field = bodyRef.current;
    if (!field || !current || preview) return;
    const body = current.body;
    assignNoteBody(field, body);
    const restore = restoreRef.current;
    if (restore?.selectedId === current.id) {
      field.scrollTop = restore.scrollTop;
      const start = Math.min(restore.selectionStart, body.length);
      const end = Math.min(restore.selectionEnd, body.length);
      field.setSelectionRange(start, end);
      restoreRef.current = null;
    }
    lengthRef.current = body.length;
  }, [current, preview, writable]);

  useEffect(() => {
    const field = bodyRef.current;
    if (!field) return;
    const onBefore = (event: Event) => {
      if (!(event instanceof InputEvent) || notesRole() !== 'writer' || !acceptRef.current || field.readOnly) return;
      const start = field.selectionStart ?? 0;
      const end = field.selectionEnd ?? start;
      const plan = planBeforeInput(
        lengthRef.current,
        start,
        end,
        event.inputType,
        event.data,
        event.dataTransfer?.getData('text/plain') ?? null,
      );
      if (plan.nextLength !== null) lengthRef.current = plan.nextLength;
      if (!plan.prevent) return;
      event.preventDefault();
      if (plan.text.length > 0) insertClippedText(field, start, end, plan.text);
      if (plan.clipped) showStatus("The rest of that paste didn't fit.");
      if (plan.dirty) {
        bodyDirty.current = true;
        noteTyped();
        scheduleSaveRef.current();
      }
      markLengthCount(lengthRef.current);
    };
    const onCompose = () => {
      if (!acceptRef.current || notesRole() !== 'writer') return;
      const caret = field.selectionStart ?? 0;
      const trimmed = trimOverflowAtCaret(field.value, caret);
      if (trimmed.clipped) {
        field.value = trimmed.text;
        field.setSelectionRange(trimmed.caret, trimmed.caret);
        showStatus("The rest of that paste didn't fit.");
      }
      lengthRef.current = trimmed.text.length;
      markLengthCount(lengthRef.current);
      bodyDirty.current = true;
      noteTyped();
      scheduleSaveRef.current();
    };
    field.addEventListener('beforeinput', onBefore);
    field.addEventListener('compositionend', onCompose);
    return () => {
      field.removeEventListener('beforeinput', onBefore);
      field.removeEventListener('compositionend', onCompose);
    };
  }, [current?.id, bodyEpoch, preview]);

  useEffect(() => {
    if (current) host.setTitle(current.title || 'Notes');
  }, [current, host]);

  const update = (patch: Partial<Note>, caret?: number) => {
    pullBody();
    const live = notesRef.current.find((note) => note.id === selectedRef.current) ?? current;
    if (!live || role !== 'writer' || problem) return;
    let clipped = false;
    const nextPatch = { ...patch };
    if (nextPatch.title !== undefined) {
      const limited = trimInsertion(live.title, nextPatch.title, caret ?? nextPatch.title.length);
      nextPatch.title = limited.text;
      clipped = clipped || limited.clipped;
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
    disarm();
    void (async () => {
      const claimed = await claimNotesHere();
      setRole(claimed);
      if (claimed !== 'writer') return;
      const loaded = await loadNotes();
      showLoadedRef.current(loaded);
    })();
  };

  const onBodyInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!acceptRef.current || notesRole() !== 'writer') return;
    const inputType = (event.nativeEvent as InputEvent).inputType;
    const mark = dispatchNoteInput(
      { dirty: bodyDirty.current, length: lengthRef.current },
      { nativeEvent: { inputType }, currentTarget: event.currentTarget },
      trimOverflowAtCaret,
    );
    if (mark.clipped && mark.value !== undefined) {
      event.currentTarget.value = mark.value;
      const caret = mark.caret ?? mark.value.length;
      event.currentTarget.setSelectionRange(caret, caret);
      showStatus("The rest of that paste didn't fit.");
    }
    lengthRef.current = mark.mark.length;
    bodyDirty.current = true;
    noteTyped();
    scheduleSave();
    markLengthCount(lengthRef.current);
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
            pullBody();
            const note = freshNote();
            const next = [note, ...notesRef.current];
            notesRef.current = next;
            lengthRef.current = 0;
            markLengthCount(0);
            setNotes(next);
            setSelected(note.id);
            bumpEpoch();
            rememberNotes(next);
            scheduleSave();
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
                  pullBody();
                  setNotes(notesRef.current);
                  const body = notesRef.current.find((item) => item.id === note.id)?.body ?? note.body;
                  lengthRef.current = body.length;
                  markLengthCount(body.length);
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
                if (!preview) {
                  pullBody();
                  setNotes(notesRef.current);
                }
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
              key={`${current.id}:${bodyEpoch}`}
              data-testid="notes-body"
              aria-label="Note"
              className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-6 outline-none"
              defaultValue={current.body}
              readOnly={!writable}
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
              onInput={onBodyInput}
            />
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}
