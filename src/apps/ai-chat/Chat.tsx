'use client';

import { useEffect, useState } from 'react';
import type { AppProps } from '@/contracts/app';
import { MOCK_LABEL, chatMemory, mockReply, type ChatLine } from './replies';

export default function Chat({ host }: AppProps) {
  const [lines, setLines] = useState<ChatLine[]>(chatMemory.lines);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    host.setTitle('Chat · Mock');
  }, [host]);

  useEffect(() => {
    chatMemory.lines = lines;
  }, [lines]);

  const send = () => {
    const text = draft.trim();
    if (!text || waiting) return;
    setDraft('');
    setLines((items) => [...items, { role: 'you', text }]);
    setWaiting(true);
    window.setTimeout(() => {
      setLines((items) => [...items, { role: 'mock', text: mockReply(text) }]);
      setWaiting(false);
    }, 700);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p data-testid="chat-mock-label" className="border-b border-white/10 px-4 py-2 text-[12px] leading-4 text-[#f2f0eb]/64">
        {MOCK_LABEL}
      </p>
      <div data-testid="chat-log" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[15px] leading-6">
        {lines.map((line, index) => (
          <p key={`${line.role}-${index}`} className={line.role === 'mock' ? 'text-[#f2f0eb]' : 'text-[#f2f0eb]/64'}>
            {line.text}
          </p>
        ))}
        {waiting ? <p className="text-[#f2f0eb]/64">…</p> : null}
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          data-testid="chat-input"
          aria-label="Message"
          className="min-w-0 flex-1 bg-transparent text-[15px] leading-6 outline-none"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" data-testid="chat-send" className="text-[13px] leading-5 text-[#86bdb2]">
          Send
        </button>
      </form>
    </div>
  );
}
