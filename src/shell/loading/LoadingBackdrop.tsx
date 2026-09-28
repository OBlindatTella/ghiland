'use client';

import { useEffect, useState } from 'react';
import { SeasidePoster } from '@/shell/landing/posters';
import { useSession } from '@/state/session';

const ARRIVE_MS = 1200;

export function LoadingBackdrop() {
  const progress = useSession((state) => state.loadProgress);
  const phase = useSession((state) => state.phase);
  const stall = useSession((state) => state.stall);
  const [gone, setGone] = useState(false);
  const fading = progress >= 1 && !gone;

  useEffect(() => {
    if (phase === 'landing') return;
    const slow = window.setTimeout(() => useSession.getState().setStall('slow'), 10_000);
    const stuck = window.setTimeout(() => useSession.getState().setStall('stuck'), 30_000);
    return () => {
      window.clearTimeout(slow);
      window.clearTimeout(stuck);
    };
  }, [phase]);

  useEffect(() => {
    if (progress < 1 || gone) return;
    const id = window.setTimeout(() => {
      useSession.getState().markActive();
      setGone(true);
    }, ARRIVE_MS);
    return () => window.clearTimeout(id);
  }, [progress, gone]);

  if (phase === 'landing' || gone) return null;

  const blur = fading ? 0 : Math.max(0, 24 * (1 - progress));

  return (
    <div
      data-testid="loading-backdrop"
      className="ghiland-move absolute inset-0 z-40 bg-[#1c1814]"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? `opacity ${ARRIVE_MS}ms cubic-bezier(0.2, 0, 0, 1)` : undefined,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          filter: `blur(${blur}px)`,
          transform: 'scale(1.08)',
          transition: 'filter 700ms linear',
        }}
      >
        <SeasidePoster />
      </div>
      <div
        className="absolute bottom-0 left-0 h-px bg-[#86bdb2]"
        style={{ width: `${progress * 100}%`, transition: 'width 200ms linear' }}
      />
      {stall === 'slow' || stall === 'stuck' ? (
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] leading-5 text-[#f2f0eb]/64">
          Still arriving…
        </p>
      ) : null}
      {stall === 'stuck' ? (
        <button
          type="button"
          className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-[6px] border border-white/10 bg-[#141413]/90 px-3 py-2 text-[13px] leading-5 text-[#f2f0eb]"
          onClick={() => useSession.getState().requestLow()}
        >
          Try Low quality
        </button>
      ) : null}
    </div>
  );
}
