'use client';

import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { AppDefinition } from '@/contracts/app';
import type { WindowInstance } from '@/contracts/window';
import { dragRect, resizeRect, type ResizeEdge } from '@/shell/windows/geometry';
import { frameTint, subscribeFrameTint } from '@/shell/windows/frameTint';
import { bindWindowElement } from '@/engine/windows/domRegistry';
import { requestDetach, requestPin, requestRecall } from '@/engine/windows/bridge';
import { closeAppWindow, focusAppWindow, minimizeAppWindow } from '@/shell/windows/commands';
import { subscribePulse, windowPulsing } from '@/shell/windows/pulse';
import { useWindows } from '@/state/windows';

const EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function cursorFor(edge: ResizeEdge): string {
  if (edge === 'n' || edge === 's') return 'ns-resize';
  if (edge === 'e' || edge === 'w') return 'ew-resize';
  if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

function bounds() {
  return { minX: 24, minY: 24, maxX: window.innerWidth - 24, maxY: window.innerHeight - 88 };
}

export function WindowFrame({
  instance,
  app,
  children,
}: {
  instance: WindowInstance;
  app: AppDefinition;
  children: ReactNode;
}) {
  const focused = useWindows((state) => state.focusedId === instance.id);
  const [tint, setTint] = useState(frameTint);
  const [lift, setLift] = useState(false);
  const [pulsing, setPulsing] = useState(() => windowPulsing(instance.id));
  const rect = instance.lastScreenRect;
  const world = instance.mode.kind !== 'overlay';
  const carried = instance.mode.kind === 'detached' || instance.mode.kind === 'worldPinned';
  const elementRef = useCallback((node: HTMLElement | null) => {
    bindWindowElement(instance.id, node);
  }, [instance.id]);

  useEffect(() => subscribeFrameTint(() => setTint(frameTint())), []);
  useEffect(() => subscribePulse(() => setPulsing(windowPulsing(instance.id))), [instance.id]);

  const onDragDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    focusAppWindow(instance.id);
    const start = { x: event.clientX, y: event.clientY, rect };
    const pointer = event.currentTarget;
    pointer.setPointerCapture(event.pointerId);
    let origin = rect;
    let outsideSince: number | null = null;
    const outside = (next: PointerEvent) => next.clientY <= 0 || next.clientX <= 0 || next.clientX >= window.innerWidth;
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x;
      const dy = next.clientY - start.y;
      if (dx * dx + dy * dy < 16 && outsideSince === null) return;
      origin = dragRect(start.rect, dx, dy, bounds());
      useWindows.getState().setRect(instance.id, origin);
      if (!outside(next)) {
        outsideSince = null;
        setLift(false);
        return;
      }
      outsideSince ??= performance.now();
      setLift(true);
    };
    const up = () => {
      const held = outsideSince !== null && performance.now() - outsideSince >= 300;
      outsideSince = null;
      setLift(false);
      pointer.removeEventListener('pointermove', move);
      pointer.removeEventListener('pointerup', up);
      if (held) requestDetach(instance.id);
    };
    pointer.addEventListener('pointermove', move);
    pointer.addEventListener('pointerup', up);
  };

  const onResizeDown = (edge: ResizeEdge) => (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    focusAppWindow(instance.id);
    const start = { x: event.clientX, y: event.clientY, rect: useWindows.getState().windows[instance.id]?.lastScreenRect ?? rect };
    const pointer = event.currentTarget;
    pointer.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      const resized = resizeRect(
        start.rect,
        edge,
        next.clientX - start.x,
        next.clientY - start.y,
        app.window.minSize,
        app.window.maxSize ?? { w: window.innerWidth - 48, h: window.innerHeight - 112 },
      );
      const fitted = dragRect(resized, 0, 0, bounds());
      useWindows.getState().setRect(instance.id, { ...resized, x: fitted.x, y: fitted.y });
    };
    const up = () => {
      pointer.removeEventListener('pointermove', move);
      pointer.removeEventListener('pointerup', up);
    };
    pointer.addEventListener('pointermove', move);
    pointer.addEventListener('pointerup', up);
  };

  return (
    <article
      ref={elementRef}
      data-ghiland-window={instance.id}
      data-app-id={instance.appId}
      data-mode={instance.mode.kind}
      data-placement={instance.mode.kind === 'worldPinned' ? instance.mode.placement : undefined}
      data-anchor={instance.mode.kind === 'worldPinned' ? instance.mode.anchorId : undefined}
      data-testid={`window-${instance.appId}`}
      data-pulse={pulsing ? 'true' : 'false'}
      className="pointer-events-auto absolute"
      style={
        world
          ? { left: 0, top: 0, width: rect.w, height: rect.h, transformOrigin: '0 0' }
          : { left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 20 + instance.z }
      }
      onPointerDown={() => focusAppWindow(instance.id)}
    >
      <div
        data-frame=""
        data-lift={lift ? 'true' : 'false'}
        className="flex h-full w-full flex-col overflow-hidden rounded-[10px] border"
        style={{
          background: tint,
          borderColor: focused || pulsing ? '#86bdb2' : 'rgba(255,255,255,0.1)',
          outline: pulsing ? '1px solid #86bdb2' : undefined,
          borderTopColor: focused ? '#86bdb2' : undefined,
          transform: lift ? 'scale(0.96)' : undefined,
          boxShadow: world ? 'none' : lift ? '0 18px 40px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.32)',
        }}
      >
          <header
          data-titlebar=""
          className="flex h-8 shrink-0 cursor-grab items-center gap-2 px-3 active:cursor-grabbing"
          onPointerDown={world ? undefined : onDragDown}
        >
          <h1
            className="min-w-0 flex-1 truncate text-[12px] leading-4 font-semibold"
            style={{ color: focused ? '#f2f0eb' : 'rgba(242,240,235,0.64)' }}
          >
            {instance.title}
          </h1>
          <button
            type="button"
            aria-label="Minimize"
            className="h-7 w-7 text-[13px] leading-5 text-[#f2f0eb]"
            style={{ opacity: focused ? 1 : 0.4 }}
            onClick={() => minimizeAppWindow(instance.id)}
          >
            –
          </button>
          <button
            type="button"
            aria-label={carried ? 'Return to Screen' : 'Pin'}
            data-testid="window-pin"
            className="h-7 w-7 text-[13px] leading-5 text-[#f2f0eb]"
            style={{ opacity: focused ? 1 : 0.4 }}
            onClick={() => (carried ? requestRecall(instance.id) : requestPin(instance.id))}
          >
            ⌖
          </button>
          <button
            type="button"
            aria-label="Close"
            className="h-7 w-7 text-[13px] leading-5 text-[#f2f0eb]"
            style={{ opacity: focused ? 1 : 0.4 }}
            onClick={() => closeAppWindow(instance.id, instance.appId)}
          >
            ×
          </button>
        </header>
        <div data-content-root="" className="min-h-0 flex-1 overflow-hidden bg-[#141413] text-[#f2f0eb]">
          {children}
        </div>
      </div>
      {app.window.resizable && !world
        ? EDGES.map((edge) => (
            <div
              key={edge}
              data-resize={edge}
              role="separator"
              aria-label={`Resize ${edge}`}
              className="absolute"
              style={handleStyle(edge, cursorFor(edge))}
              onPointerDown={onResizeDown(edge)}
            />
          ))
        : null}
    </article>
  );
}

function handleStyle(edge: ResizeEdge, cursor: string): { cursor: string; top?: number; left?: number; right?: number; bottom?: number; width?: number | string; height?: number | string } {
  const band = 6;
  const corner = 14;
  if (edge === 'n') return { cursor, top: -band, left: corner, right: corner, height: band * 2 };
  if (edge === 's') return { cursor, bottom: -band, left: corner, right: corner, height: band * 2 };
  if (edge === 'e') return { cursor, right: -band, top: corner, bottom: corner, width: band * 2 };
  if (edge === 'w') return { cursor, left: -band, top: corner, bottom: corner, width: band * 2 };
  if (edge === 'ne') return { cursor, top: -band, right: -band, width: corner, height: corner };
  if (edge === 'nw') return { cursor, top: -band, left: -band, width: corner, height: corner };
  if (edge === 'se') return { cursor, bottom: -band, right: -band, width: corner, height: corner };
  return { cursor, bottom: -band, left: -band, width: corner, height: corner };
}
