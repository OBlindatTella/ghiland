'use client';

import { useEffect, useState } from 'react';
import { PerfHud } from '@/engine/perf/PerfHud';
import { Shelf } from '@/shell/launcher/Shelf';
import { screenKeyLabel } from '@/shell/keyLabel';
import { SettingsPanel } from '@/shell/screen/SettingsPanel';
import { FocusGuard } from '@/shell/windows/FocusGuard';
import { WindowLayer } from '@/shell/windows/WindowLayer';
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
  const [screenKey, setScreenKey] = useState(() => screenKeyLabel(null));

  useEffect(() => {
    document.body.dataset.shell = shell;
  }, [shell]);

  useEffect(() => {
    const keyboard = (navigator as Navigator & {
      keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> };
    }).keyboard;
    if (!keyboard?.getLayoutMap) return;
    let live = true;
    void keyboard.getLayoutMap().then((map) => {
      if (live) setScreenKey(screenKeyLabel(map));
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return (
    <div data-ghiland-screen="" className="contents">
      <FocusGuard />
      <div data-testid="shell-state" data-shell={shell} className="sr-only">
        {shell}
      </div>
      {shell !== 'WORLD' ? (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ background: shell === 'SCREEN' ? 'rgba(0,0,0,0.12)' : 'transparent' }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 z-20 bg-[#1c1814]"
        style={{ opacity: dim ? 0.45 : 0, transition: 'opacity 200ms linear' }}
      />
      <WindowLayer />
      <Shelf />
      <SettingsPanel />
      <RestoringVeil />
      {active && showHint ? (
        <p
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#141413]/90 px-4 py-2 text-[13px] leading-5 text-[#f2f0eb]"
        >
          Click to walk · {screenKey} Screen
        </p>
      ) : null}
      {showPerf ? <PerfHud /> : null}
    </div>
  );
}
