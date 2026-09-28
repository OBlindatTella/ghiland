'use client';

import { useEffect, useRef } from 'react';
import { PerfHud } from '@/engine/perf/PerfHud';
import { inputManager } from '@/engine/input/InputManager';
import { useInputStore } from '@/state/input';
import { usePerfStore } from '@/state/perf';

function ScreenPanel() {
  return (
    <div
      role="region"
      aria-label="Ghiland Screen"
      className="absolute top-1/2 left-1/2 w-[min(420px,calc(100%-48px))] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-white/10 bg-[#141413]/92 p-4 text-[#f2f0eb] shadow-[0_8px_24px_rgba(0,0,0,0.32)]"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <h1 className="text-[18px] leading-6 font-semibold">Ghiland Screen</h1>
      <p className="mt-2 text-[13px] leading-5 text-[#f2f0eb]/80">Movement is paused.</p>
      <p className="mt-2 text-[13px] leading-5 text-[#f2f0eb]/70">
        Q, or a click on the world, walks again. Esc steps back.
      </p>
    </div>
  );
}

export function ShellChrome() {
  const shell = useInputStore((state) => state.shellState);
  const showHint = useInputStore((state) => state.showClickToWalk);
  const showPerf = usePerfStore((state) => state.visible);
  const press = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.body.dataset.shell = shell;
  }, [shell]);

  const catchClicks = shell !== 'WORLD';

  return (
    <>
      <div data-testid="shell-state" data-shell={shell} className="sr-only">
        {shell}
      </div>
      {catchClicks ? (
        <div
          className="absolute inset-0 z-10"
          style={{ background: shell === 'SCREEN' ? 'rgba(0,0,0,0.12)' : 'transparent' }}
          onPointerDown={(event) => {
            press.current = { x: event.clientX, y: event.clientY };
          }}
          onClick={(event) => {
            const origin = press.current;
            press.current = null;
            if (!origin) return;
            const dx = event.clientX - origin.x;
            const dy = event.clientY - origin.y;
            if (dx * dx + dy * dy > 16) return;
            inputManager.clickEmptyWorld();
          }}
        >
          {shell === 'SCREEN' ? <ScreenPanel /> : null}
          {showHint ? (
            <p
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-[#141413]/90 px-4 py-2 text-[13px] text-[#f2f0eb]"
            >
              Click to walk
            </p>
          ) : null}
        </div>
      ) : null}
      {showPerf ? <PerfHud /> : null}
    </>
  );
}
