'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppProps } from '@/contracts/app';
import { renderLightMarkdown } from './markdown';
import {
  flushNotes,
  limitNoteText,
  loadNotes,
  noteNearingLimit,
  notesRole,
  rememberNotes,
  saveNotes,
  startNotesSession,
  subscribeNotesRole,
  claimNotesHere,
  type Note,
} from './storage';

function freshNote(): Note {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
    title: 'Untitled',
    body: '',
    updatedAt: Date.now(),
  };
}

export default function Notes({ host }: AppProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState('');
  const [role, setRole] = useState(notesRole);
  const [problem, setProblem] = useState<'blocked' | 'unavailable' | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const ready = useRef(false);
  const notesRef = useRef(notes);

  useEffect(() => subscribeNotesRole(setRole), []);

  useEffect(() => {
    let live = true;
    void (async () => {
      const claimed = await startNotesSession();
      if (!live) return;
      setRole(claimed);
      setSessionReady(true);
      const loaded = await loadNotes();
      if (!live) return;
      if (loaded.status !== 'ok') {
        setProblem(loaded.status);
        return;
      }
      const next = loaded.notes.length > 0 ? loaded.notes : [freshNote()];
      setNotes(next);
      setSelected(next[0]?.id ?? null);
      ready.current = claimed === 'writer';
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    notesRef.current = notes;
    if (!ready.current) return;
    rememberNotes(notes);
    const handle = window.setTimeout(() => {
      void saveNotes(notes).then((result) => {
        if (result === 'ok') setStatus('Saved');
        else if (result === 'blocked') setProblem('blocked');
        else if (result === 'quota') setStatus("This browser couldn't store that.");
        else if (result === 'unavailable') setProblem('unavailable');
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [notes]);

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

  useEffect(() => {
    if (current) host.setTitle(current.title || 'Notes');
  }, [current, host]);

  const update = (patch: Partial<Note>) => {
    if (!current || role !== 'writer' || problem) return;
    let clipped = false;
    const nextPatch = { ...patch };
    if (nextPatch.title !== undefined) {
      const limited = limitNoteText(nextPatch.title);
      nextPatch.title = limited.text;
      clipped = clipped || limited.clipped;
    }
    if (nextPatch.body !== undefined) {
      const limited = limitNoteText(nextPatch.body);
      nextPatch.body = limited.text;
      clipped = clipped || limited.clipped;
    }
    if (clipped) setStatus("The rest of that paste didn't fit.");
    setNotes((items) => {
      const next = items.map((note) => (note.id === current.id ? { ...note, ...nextPatch, updatedAt: Date.now() } : note));
      rememberNotes(next);
      return next;
    });
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
      setNotes(next);
      setSelected(next[0]?.id ?? null);
      ready.current = true;
      setProblem(null);
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
            setNotes((items) => [note, ...items]);
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
                onClick={() => setSelected(note.id)}
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
            onChange={(event) => update({ title: event.target.value })}
          />
          <div className="flex items-center justify-between px-4 pt-2 text-[12px] leading-4 text-[#f2f0eb]/64">
            <span className="flex min-w-0 flex-col">
              {current && noteNearingLimit(current.body) ? <span>This note is getting long.</span> : null}
              <span>{status}</span>
            </span>
            <button type="button" onClick={() => setPreview((value) => !value)}>
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
              data-testid="notes-body"
              aria-label="Note"
              autoFocus
              className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-6 outline-none"
              value={current.body}
              readOnly={role !== 'writer' || problem !== null}
              onChange={(event) => update({ body: event.target.value })}
            />
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}
