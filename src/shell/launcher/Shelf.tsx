'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { apps } from '@/apps/registry';
import { inputManager } from '@/engine/input/InputManager';
import { openAppWindow, restoreAppWindow } from '@/shell/windows/commands';
import { useInputStore } from '@/state/input';
import { useScreenStore } from '@/state/screen';
import { useWindows } from '@/state/windows';

function Tile({
  id,
  label,
  open,
  onOpen,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const hover = useRef(0);
  const show = () => setShown(true);
  const arm = () => {
    window.clearTimeout(hover.current);
    hover.current = window.setTimeout(show, 400);
  };
  const hide = () => {
    window.clearTimeout(hover.current);
    setShown(false);
  };
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={`tile-${id}`}
      className="relative flex h-14 w-14 items-center justify-center rounded-[8px] text-[#f2f0eb]"
      onMouseEnter={arm}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={onOpen}
    >
      {shown ? (
        <span className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-[13px] leading-5 whitespace-nowrap">
          {label}
        </span>
      ) : null}
      {children}
      {open ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#86bdb2]" /> : null}
    </button>
  );
}

export function Shelf() {
  const shell = useInputStore((state) => state.shellState);
  const focused = useScreenStore((state) => state.stack.includes('launcher'));
  const windows = useWindows((state) => state.windows);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) ref.current?.focus({ preventScroll: true });
  }, [focused]);

  if (shell !== 'SCREEN') return null;

  const minimized = Object.values(windows).filter((item) => item.state === 'minimized');
  const openIds = new Set(Object.values(windows).map((item) => item.appId));

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(ref.current?.querySelectorAll('button') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowRight' && index >= 0) {
      event.preventDefault();
      buttons[Math.min(buttons.length - 1, index + 1)]?.focus({ preventScroll: true });
    } else if (event.key === 'ArrowLeft' && index >= 0) {
      event.preventDefault();
      buttons[Math.max(0, index - 1)]?.focus({ preventScroll: true });
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="toolbar"
      aria-label="Launcher"
      data-testid="launcher"
      className="ghiland-shelf absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-[8px] border border-white/10 bg-[#1c1c1a]/94 p-2 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#86bdb2]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      {apps.map((app) => (
        <Tile
          key={app.id}
          id={app.id}
          label={app.title}
          open={openIds.has(app.id)}
          onOpen={() => {
            if (app.integration.kind === 'external') {
              inputManager.noteExternalOpen();
              window.open(app.integration.url, '_blank', 'noopener,noreferrer');
            }
            openAppWindow(app);
          }}
        >
          <span aria-hidden="true" className="text-[15px] leading-5">
            {app.icon}
          </span>
        </Tile>
      ))}
      <Tile
        id="settings"
        label="Settings"
        open={false}
        onOpen={() => useScreenStore.getState().push('settings')}
      >
        <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M7 1.2v1.6M7 11.2v1.6M1.2 7h1.6M11.2 7h1.6M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </Tile>
      {minimized.length > 0 ? <span className="mx-1 h-8 w-px bg-white/10" /> : null}
      {minimized.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-label={`Restore ${item.title}`}
          data-testid={`tray-${item.appId}`}
          title={item.title}
          className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/10 text-[12px] leading-4"
          onClick={() => restoreAppWindow(item.id)}
        >
          {item.title.slice(0, 1)}
        </button>
      ))}
    </div>
  );
}
