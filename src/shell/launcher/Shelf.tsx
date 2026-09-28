'use client';

import { useEffect, useRef, useState } from 'react';
import { useInputStore } from '@/state/input';
import { useScreenStore } from '@/state/screen';

export function Shelf() {
  const shell = useInputStore((state) => state.shellState);
  const focused = useScreenStore((state) => state.stack.includes('launcher'));
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(false);
  const hover = useRef(0);

  useEffect(() => {
    if (focused) ref.current?.focus();
  }, [focused]);

  if (shell !== 'SCREEN') return null;

  const showLabel = () => setLabel(true);
  const armLabel = () => {
    window.clearTimeout(hover.current);
    hover.current = window.setTimeout(showLabel, 400);
  };
  const hideLabel = () => {
    window.clearTimeout(hover.current);
    setLabel(false);
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="toolbar"
      aria-label="Launcher"
      data-testid="launcher"
      className="ghiland-shelf absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-[8px] border border-white/10 bg-[#1c1c1a]/94 p-2 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#86bdb2]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Settings"
        data-testid="settings-tile"
        className="relative flex h-10 w-10 items-center justify-center rounded-[8px] text-[#f2f0eb]"
        onMouseEnter={armLabel}
        onMouseLeave={hideLabel}
        onFocus={showLabel}
        onBlur={hideLabel}
        onClick={() => useScreenStore.getState().push('settings')}
      >
        {label ? (
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[13px] leading-5 whitespace-nowrap">Settings</span>
        ) : null}
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M7 1.2v1.6M7 11.2v1.6M1.2 7h1.6M11.2 7h1.6M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
    </div>
  );
}
