'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import type { AppDefinition, AppHostApi, AppProps, NamespacedStorage } from '@/contracts/app';
import { inputManager } from '@/engine/input/InputManager';
import { closeAppWindow, focusAppWindow } from '@/shell/windows/commands';
import { useWindows } from '@/state/windows';

function storageFor(appId: string): NamespacedStorage {
  const prefix = `ghiland:app:${appId}:`;
  return {
    get: (key) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(prefix + key)),
    set: (key, value) => localStorage.setItem(prefix + key, value),
    remove: (key) => localStorage.removeItem(prefix + key),
  };
}

function ExternalCard({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-4 px-6" data-testid="external-card">
      <p className="text-[15px] leading-6 text-[#f2f0eb]">
        {title} does not open inside Ghiland. It opens in a new browser tab, and this card stays here so you can come back.
      </p>
      <button
        type="button"
        data-testid="external-open"
        className="rounded-[6px] border border-white/10 px-3 py-2 text-[13px] leading-5"
        onClick={() => {
          inputManager.noteExternalOpen();
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
      >
        Open in a new tab
      </button>
    </div>
  );
}

export function AppHost({ app, windowId }: { app: AppDefinition; windowId: string }) {
  const [Comp, setComp] = useState<ComponentType<AppProps> | null>(null);
  const load = app.integration.kind === 'native' ? app.integration.load : null;

  useEffect(() => {
    if (!load) return;
    let live = true;
    void load().then((mod) => {
      if (live) setComp(() => mod.default);
    });
    return () => {
      live = false;
    };
  }, [load]);

  const host = useMemo<AppHostApi>(
    () => ({
      setTitle: (title) => useWindows.getState().setTitle(windowId, title),
      close: () => closeAppWindow(windowId, app.id),
      requestFocus: () => focusAppWindow(windowId),
      storage: storageFor(app.id),
      emit: () => undefined,
    }),
    [app.id, windowId],
  );

  if (app.integration.kind === 'external') {
    return <ExternalCard url={app.integration.url} title={app.title} />;
  }
  if (app.integration.kind === 'embed') {
    return (
      <p className="px-6 py-8 text-[15px] leading-6 text-[#f2f0eb]/64">
        This page is meant to sit in a frame. If it stays blank, use the external card instead.
      </p>
    );
  }
  if (!Comp) return null;
  return <Comp windowId={windowId} host={host} />;
}
