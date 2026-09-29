import type { AppDefinition } from '@/contracts/app';
import { audioEngine } from '@/engine/audio/engine';
import { bus } from '@/engine/events/bus';
import { readWindowsFile } from '@/shell/windows/persistence';
import { useWindows } from '@/state/windows';

function viewport(): { w: number; h: number } {
  return { w: window.innerWidth, h: window.innerHeight };
}

export function openAppWindow(app: AppDefinition): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `win-${Date.now()}`;
  const result = useWindows.getState().open({
    id,
    appId: app.id,
    title: app.title,
    defaultSize: app.window.defaultSize,
    viewport: viewport(),
    now: Date.now(),
    savedRect: readWindowsFile().rects[app.id],
  });
  audioEngine.playUi(result.created ? 'open' : 'focus');
  if (result.created) bus.emit('window:opened', { windowId: result.id, appId: app.id });
  return result.id;
}

export function closeAppWindow(id: string, appId: string): void {
  useWindows.getState().close(id);
  audioEngine.playUi('close');
  bus.emit('window:closed', { windowId: id, appId });
}

export function minimizeAppWindow(id: string): void {
  useWindows.getState().minimize(id);
  audioEngine.playUi('minimize');
}

export function restoreAppWindow(id: string): void {
  useWindows.getState().restore(id);
  audioEngine.playUi('open');
}

export function focusAppWindow(id: string): void {
  const current = useWindows.getState().focusedId;
  useWindows.getState().focus(id);
  if (current !== id) audioEngine.playUi('focus');
}
