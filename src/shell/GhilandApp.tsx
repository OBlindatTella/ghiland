'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ShellChrome } from '@/shell/ShellChrome';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';

const loadExperience = () => import('@/engine/canvas/Experience');

const Experience = dynamic(() => loadExperience().then((mod) => mod.Experience), { ssr: false });

function prefetchEngine(): void {
  void loadExperience();
}

function scheduleIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task);
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 200);
  return () => window.clearTimeout(id);
}

function Landing({
  preselected,
  unknown,
  onEnter,
}: {
  preselected: boolean;
  unknown: boolean;
  onEnter: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (preselected) buttonRef.current?.focus();
  }, [preselected]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#1c1814] text-[#f2f0eb]">
      <p className="absolute bottom-8 left-8 text-[13px] tracking-wide">Ghiland</p>
      <div className="flex w-[min(420px,calc(100%-48px))] flex-col gap-4">
        <button
          ref={buttonRef}
          type="button"
          onMouseEnter={prefetchEngine}
          onFocus={prefetchEngine}
          onClick={onEnter}
          className="rounded-[10px] border border-white/10 bg-[#24201c] p-3 text-left outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#86bdb2]"
          style={preselected ? { outline: '2px solid #86bdb2', outlineOffset: 4 } : undefined}
        >
          <span className="block aspect-video w-full rounded-[6px] bg-[#c4b49a]" />
          <span className="mt-3 block text-[18px] leading-6 font-semibold">Seaside House</span>
          <span className="mt-1 block text-[13px] leading-5 text-[#f2f0eb]/70">A corridor, then the glass.</span>
        </button>
        {unknown ? <p className="text-[13px] text-[#f2f0eb]/70">That place is not here yet.</p> : null}
      </div>
    </div>
  );
}

export function GhilandApp() {
  const pathname = usePathname();
  const phase = useSession((state) => state.phase);

  useEffect(() => scheduleIdle(prefetchEngine), []);

  const preselected = pathname === '/w/seaside-house';
  const unknown = pathname.startsWith('/w/') && !preselected;

  if (phase === 'inWorld') {
    return (
      <div className="relative h-full w-full">
        <Experience />
        <ShellChrome />
      </div>
    );
  }

  return (
    <Landing
      preselected={preselected}
      unknown={unknown}
      onEnter={() => {
        useInputStore.getState().reset();
        useSession.getState().enterSeaside();
        if (window.location.pathname !== '/w/seaside-house') {
          window.history.pushState(null, '', '/w/seaside-house');
        }
      }}
    />
  );
}
