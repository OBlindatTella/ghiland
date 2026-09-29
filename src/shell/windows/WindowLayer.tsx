'use client';

import { useCallback, useEffect } from 'react';
import { fitRect } from '@/shell/windows/geometry';
import { getApp } from '@/apps/registry';
import { bindGhost, bindStage } from '@/engine/windows/domRegistry';
import { AppHost } from '@/shell/windows/AppHost';
import { WindowFrame } from '@/shell/windows/WindowFrame';
import { useInputStore } from '@/state/input';
import { useWindows } from '@/state/windows';

/** Overlay windows stay mounted and are hidden outside SCREEN (D-006). World windows stay projected. */
export function WindowLayer() {
  const shell = useInputStore((state) => state.shellState);
  const windows = useWindows((state) => state.windows);
  const visible = shell === 'SCREEN';
  const stageRef = useCallback((node: HTMLDivElement | null) => {
    bindStage(node);
  }, []);
  const ghostRef = useCallback((node: HTMLDivElement | null) => {
    bindGhost(node);
  }, []);

  useEffect(() => {
    const clamp = () => {
      const limit = { minX: 24, minY: 24, maxX: window.innerWidth - 24, maxY: window.innerHeight - 88 };
      for (const item of Object.values(useWindows.getState().windows)) {
        if (item.mode.kind !== 'overlay') continue;
        const next = fitRect(item.mode.rect, limit);
        if (next.x !== item.mode.rect.x || next.y !== item.mode.rect.y || next.w !== item.mode.rect.w || next.h !== item.mode.rect.h) {
          useWindows.getState().setRect(item.id, next);
        }
      }
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  useEffect(() => {
    if (visible) return;
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest?.('[data-ghiland-window]')) active.blur();
  }, [visible]);

  useEffect(() => {
    const node = document.querySelector<HTMLElement>('[data-testid="window-stage"]');
    if (!node) return;
    const pin = () => {
      if (node.scrollTop !== 0) node.scrollTop = 0;
      if (node.scrollLeft !== 0) node.scrollLeft = 0;
    };
    node.addEventListener('scroll', pin);
    pin();
    return () => node.removeEventListener('scroll', pin);
  }, []);

  const open = Object.values(windows)
    .filter((item) => item.state !== 'minimized')
    .sort((a, b) => a.z - b.z);
  const overlay = open.filter((item) => item.mode.kind === 'overlay');
  const spatial = open.filter((item) => item.mode.kind !== 'overlay');

  return (
    <>
      <div data-testid="window-stage" className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
        <div
          ref={stageRef}
          data-testid="window-projector"
          className="absolute top-0 left-0"
          style={{ transformStyle: 'preserve-3d', transformOrigin: '0 0', width: 0, height: 0 }}
        >
          <div
            ref={ghostRef}
            data-testid="placement-ghost"
            hidden
            className="pointer-events-none absolute top-0 left-0"
            style={{ outline: '1px solid #86bdb2', outlineOffset: 0 }}
          />
          {spatial.map((instance) => {
            const app = getApp(instance.appId);
            if (!app) return null;
            return (
              <WindowFrame key={instance.id} instance={instance} app={app}>
                <AppHost app={app} windowId={instance.id} />
              </WindowFrame>
            );
          })}
        </div>
      </div>
      <div data-ghiland-window-layer="" className="pointer-events-none absolute inset-0 z-20" hidden={!visible}>
        {overlay.map((instance) => {
          const app = getApp(instance.appId);
          if (!app) return null;
          return (
            <WindowFrame key={instance.id} instance={instance} app={app}>
              <AppHost app={app} windowId={instance.id} />
            </WindowFrame>
          );
        })}
      </div>
    </>
  );
}
