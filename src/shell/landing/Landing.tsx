'use client';

import { useEffect, useRef, useState } from 'react';
import { worlds } from '@/worlds/registry';
import { BalconyPoster, FarmPoster, SeasidePoster } from '@/shell/landing/posters';

function prefetchEngine(): void {
  void import('@/engine/canvas/Experience');
}

export function Landing({
  preselected,
  unknown,
  onEnter,
}: {
  preselected: boolean;
  unknown: boolean;
  onEnter: () => void;
}) {
  const seasideRef = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const seaside = worlds.find((world) => world.id === 'seaside-house');
  const previews = worlds.filter((world) => world.status === 'preview');

  useEffect(() => {
    seasideRef.current?.focus();
  }, [preselected]);

  return (
    <div className="relative h-full w-full bg-[#1c1814] text-[#f2f0eb]">
      <p className="absolute bottom-8 left-8 text-[13px] leading-5">Ghiland</p>
      <div className="absolute top-[18%] left-[8%] flex items-start gap-6 max-[800px]:left-6 max-[800px]:flex-col">
        <button
          ref={seasideRef}
          type="button"
          data-testid="card-seaside"
          onMouseEnter={prefetchEngine}
          onFocus={prefetchEngine}
          onClick={onEnter}
          className="w-[min(520px,70vw)] rounded-[10px] border border-white/10 bg-[#141413]/90 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#86bdb2]"
        >
          <span className="block aspect-[16/10] overflow-hidden rounded-[6px] bg-[#5A4C3E]">
            <SeasidePoster />
          </span>
          <span className="mt-3 block text-[18px] leading-6 font-semibold">{seaside?.title}</span>
          <span className="mt-1 block text-[13px] leading-5 text-[#f2f0eb]/64">{seaside?.tagline}</span>
        </button>
        <div className="flex flex-col gap-4 pt-8">
          {previews.map((world) => (
            <button
              key={world.id}
              type="button"
              data-testid={`card-${world.id}`}
              onClick={() => setNote(world.id)}
              className="w-[240px] rounded-[10px] border border-white/10 bg-[#141413]/90 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#86bdb2]"
            >
              <span className="block aspect-[16/10] overflow-hidden rounded-[6px] saturate-[0.4]">
                {world.id === 'ny-balcony' ? <BalconyPoster /> : <FarmPoster />}
              </span>
              <span className="mt-3 block text-[15px] leading-[22px] font-semibold">{world.title}</span>
              <span className="mt-1 block text-[12px] leading-4 text-[#f2f0eb]/64">Soon</span>
              {note === world.id ? (
                <span className="mt-2 block text-[13px] leading-5 text-[#f2f0eb]/64">
                  Alpha 0.2
                  <span className="mt-1 block">
                    {world.id === 'ny-balcony' ? 'Blue hour, just after rain.' : 'A porch over the wheat.'}
                  </span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      {unknown ? (
        <p className="absolute right-8 bottom-8 text-[13px] leading-5 text-[#f2f0eb]/64">That place is not here yet.</p>
      ) : null}
    </div>
  );
}
