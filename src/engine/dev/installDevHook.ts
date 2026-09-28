import { audioEngine } from '@/engine/audio/engine';
import { readLiveComposer, readTrackedGpuBytes } from '@/engine/quality/QualityDirector';
import { queuePlayerTransform } from '@/engine/player/playerCommand';
import { playerRef, type PlayerSnapshot } from '@/engine/player/playerRef';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';

/** Development, or a production build started with NEXT_PUBLIC_GHILAND_TEST_HOOKS=1. Off by default. */
export function devHooksEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_GHILAND_TEST_HOOKS === '1';
}

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
      getGpuMemory: () => { bytes: number; textures: number; geometries: number };
      getComposer: () => ReturnType<typeof readLiveComposer>;
      setPlayer: (snapshot: PlayerSnapshot) => void;
    };
  }
}

export function installDevHook(
  getCanvasMounts: () => number,
  getView?: () => { dpr: number; shadows: boolean; fov: number | null },
  getRendererInfo?: () => { textures: number; geometries: number; toneMapping: number },
): void {
  if (!devHooksEnabled()) return;
  window.__ghiland = {
    getShell: () => useInputStore.getState().shellState,
    getPointerLocked: () => useInputStore.getState().pointerLocked,
    getPlayer: () => playerRef.current,
    setPlayer: (snapshot) => {
      queuePlayerTransform({
        x: snapshot.position.x,
        y: snapshot.position.y,
        z: snapshot.position.z,
        yaw: snapshot.yaw,
        pitch: snapshot.pitch,
      });
      playerRef.current = snapshot;
    },
    getCanvasMounts,
    getAudio: () => audioEngine.debug(),
    getHint: () => useInputStore.getState().showClickToWalk,
    getPhase: () => {
      const session = useSession.getState();
      return { phase: session.phase, worldPhase: session.worldPhase, progress: session.loadProgress };
    },
    getView: () => getView?.() ?? null,
    getGpuMemory: () => {
      const info = getRendererInfo?.() ?? { textures: 0, geometries: 0, toneMapping: 0 };
      return { bytes: readTrackedGpuBytes(), textures: info.textures, geometries: info.geometries };
    },
    getComposer: () => readLiveComposer(getRendererInfo?.().toneMapping ?? 0),
  };
}
