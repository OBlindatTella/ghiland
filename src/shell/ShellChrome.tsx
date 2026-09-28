'use client';

import { useEffect, useRef } from 'react';
import { PerfHud } from '@/engine/perf/PerfHud';
import { inputManager } from '@/engine/input/InputManager';
import { Shelf } from '@/shell/launcher/Shelf';
import { SettingsPanel } from '@/shell/screen/SettingsPanel';
import { RestoringVeil } from '@/shell/screen/RestoringVeil';
import { useAppliedQuality } from '@/state/appliedQuality';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';

export function ShellChrome() {
  const shell = useInputStore((state) => state.shellState);
  const showHint = useInputStore((state) => state.showClickToWalk);
  const showPerf = useSettings((state) => state.showPerfHud);
  const dim = useAppliedQuality((state) => state.dim);
  const active = useSession((state) => state.worldPhase === 'active');
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
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 z-20 bg-[#1c1814]"
        style={{ opacity: dim ? 0.45 : 0, transition: 'opacity 200ms linear' }}
      />
      <Shelf />
      <SettingsPanel />
      <RestoringVeil />
      {active && showHint ? (
        <p
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#141413]/90 px-4 py-2 text-[13px] leading-5 text-[#f2f0eb]"
        >
          Click to walk
        </p>
      ) : null}
      {showPerf ? <PerfHud /> : null}
    </>
  );
}
