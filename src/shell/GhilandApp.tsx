'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { beginWorldAudio } from '@/engine/audio';
import { unlockAudio } from '@/engine/audio/unlock';
import { LoadingBackdrop } from '@/shell/loading/LoadingBackdrop';
import { Landing } from '@/shell/landing/Landing';
import { ShellChrome } from '@/shell/ShellChrome';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';

const loadExperience = () => import('@/engine/canvas/Experience');

const Experience = dynamic(() => loadExperience().then((mod) => mod.Experience), { ssr: false });

function scheduleIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task);
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 200);
  return () => window.clearTimeout(id);
}

export function GhilandApp() {
  const pathname = usePathname();
  const phase = useSession((state) => state.phase);
  const preselected = pathname === '/w/seaside-house';
  const unknown = pathname.startsWith('/w/') && !preselected;
  const inWorld = phase !== 'landing';

  useEffect(() => scheduleIdle(() => void loadExperience()), []);

  const onEnter = () => {
    unlockAudio();
    beginWorldAudio('seaside-house');
    useInputStore.getState().reset();
    useSession.getState().beginSeaside();
    if (window.location.pathname !== '/w/seaside-house') {
      window.history.pushState(null, '', '/w/seaside-house');
    }
  };

  return (
    <div className="relative h-full w-full">
      {inWorld ? <Experience /> : null}
      {inWorld ? <ShellChrome /> : null}
      {inWorld ? <LoadingBackdrop /> : null}
      {phase === 'landing' ? <Landing preselected={preselected} unknown={unknown} onEnter={onEnter} /> : null}
    </div>
  );
}
