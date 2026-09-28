'use client';

import { useEffect } from 'react';
import { getApp } from '@/apps/registry';
import { AppHost } from '@/shell/windows/AppHost';
import { WindowFrame } from '@/shell/windows/WindowFrame';
import { useInputStore } from '@/state/input';
import { useWindows } from '@/state/windows';

/** Overlay windows stay mounted and are hidden outside SCREEN (D-006). */
export function WindowLayer() {
  const shell = useInputStore((state) => state.shellState);
  const windows = useWindows((state) => state.windows);
  const visible = shell === 'SCREEN';

  useEffect(() => {
    if (visible) return;
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest?.('[data-ghiland-window]')) active.blur();
  }, [visible]);

  const open = Object.values(windows)
    .filter((item) => item.mode.kind === 'overlay' && item.state !== 'minimized')
    .sort((a, b) => a.z - b.z);

  return (
    <div data-ghiland-window-layer="" className="pointer-events-none absolute inset-0 z-20" hidden={!visible}>
      {open.map((instance) => {
        const app = getApp(instance.appId);
        if (!app) return null;
        return (
          <WindowFrame key={instance.id} instance={instance} app={app}>
            <AppHost app={app} windowId={instance.id} />
          </WindowFrame>
        );
      })}
    </div>
  );
}
