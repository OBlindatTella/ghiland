import { audioEngine } from '@/engine/audio/engine';
import { playerRef } from '@/engine/player/playerRef';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';

declare global {
  interface Window {
    __ghiland?: {
      getShell: () => string;
      getPointerLocked: () => boolean;
      getPlayer: () => typeof playerRef.current;
      getCanvasMounts: () => number;
      getAudio: () => ReturnType<typeof audioEngine.debug>;
      getHint: () => boolean;
      getPhase: () => { phase: string; worldPhase: string; progress: number };
      getView: () => { dpr: number; shadows: boolean; fov: number | null } | null;
    };
  }
}

export function installDevHook(
  getCanvasMounts: () => number,
  getView?: () => { dpr: number; shadows: boolean; fov: number | null },
): void {
  if (process.env.NODE_ENV === 'production') return;
  window.__ghiland = {
    getShell: () => useInputStore.getState().shellState,
    getPointerLocked: () => useInputStore.getState().pointerLocked,
    getPlayer: () => playerRef.current,
    getCanvasMounts,
    getAudio: () => audioEngine.debug(),
    getHint: () => useInputStore.getState().showClickToWalk,
    getPhase: () => {
      const session = useSession.getState();
      return { phase: session.phase, worldPhase: session.worldPhase, progress: session.loadProgress };
    },
    getView: () => getView?.() ?? null,
  };
}
