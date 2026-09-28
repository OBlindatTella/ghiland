import { playerRef } from '@/engine/player/playerRef';
import { useInputStore } from '@/state/input';

declare global {
  interface Window {
    __ghiland?: {
      getShell: () => string;
      getPointerLocked: () => boolean;
      getPlayer: () => typeof playerRef.current;
      getCanvasMounts: () => number;
    };
  }
}

export function installDevHook(getCanvasMounts: () => number): void {
  if (process.env.NODE_ENV === 'production') return;
  window.__ghiland = {
    getShell: () => useInputStore.getState().shellState,
    getPointerLocked: () => useInputStore.getState().pointerLocked,
    getPlayer: () => playerRef.current,
    getCanvasMounts,
  };
}
