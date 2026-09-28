'use client';

import { useEffect, useRef } from 'react';
import { useInputStore } from '@/state/input';
import { useScreenStore } from '@/state/screen';

/** Empty launcher. Sized to one tile so the Screen has a home before apps exist. */
export function Shelf() {
  const shell = useInputStore((state) => state.shellState);
  const focused = useScreenStore((state) => state.stack.includes('launcher'));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) ref.current?.focus();
  }, [focused]);

  if (shell !== 'SCREEN') return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="toolbar"
      aria-label="Launcher"
      data-testid="launcher"
      data-focused={focused ? 'true' : 'false'}
      className="ghiland-shelf absolute bottom-4 left-1/2 z-30 h-14 w-14 -translate-x-1/2 rounded-[8px] border border-white/10 bg-[#1c1c1a]/94 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#86bdb2]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
