'use client';

import { useEffect, useState } from 'react';
import { flushNotes } from '@/apps/notes/storage';
import { useGlStore } from '@/state/gl';

function ReloadOffer({ lostAt }: { lostAt: number }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wait = Math.max(0, 5000 - (performance.now() - lostAt));
    const id = window.setTimeout(() => setReady(true), wait);
    return () => window.clearTimeout(id);
  }, [lostAt]);

  if (!ready) return null;

  return (
    <button
      type="button"
      className="mt-4 rounded-[6px] border border-white/10 bg-[#1c1c1a] px-3 py-2 text-[13px] leading-5"
      onClick={() => {
        void flushNotes().finally(() => window.location.reload());
      }}
    >
      Reload
    </button>
  );
}

export function RestoringVeil() {
  const lost = useGlStore((state) => state.lost);
  const lostAt = useGlStore((state) => state.lostAt);
  if (!lost || lostAt === null) return null;

  return (
    <div
      role="status"
      data-testid="restoring-veil"
      className="absolute inset-0 z-50 flex items-center justify-center bg-[#141413] text-[#f2f0eb]"
    >
      <div className="text-center">
        <p className="text-[18px] leading-6">Restoring</p>
        <ReloadOffer lostAt={lostAt} />
      </div>
    </div>
  );
}
