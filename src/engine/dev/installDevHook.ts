import { audioEngine } from '@/engine/audio/engine';
import { runCameraPath, type CameraStop } from '@/engine/dev/cameraPath';
import { injectMalformedPin, armQuotaError } from '@/engine/dev/storageFaults';
import { exposureSample } from '@/engine/environment/exposureSample';
import { readLiveComposer, readTrackedGpuBytes } from '@/engine/quality/QualityDirector';
import { setFakeFps } from '@/engine/quality/fakeFps';
import { queuePlayerTransform } from '@/engine/player/playerCommand';
import { playerRef, type PlayerSnapshot } from '@/engine/player/playerRef';
import { clearCarryFrames, readCarryFrames, setCarryTrace, type CarryFrame } from '@/engine/windows/carryPose';
import { raySetMembers, type RayMember } from '@/engine/windows/raySets';
import type { QualitySetting } from '@/contracts/quality';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';
import { perfSample } from '@/state/perf';
import { useSettings } from '@/state/settings';
import { useWindows } from '@/state/windows';
import { getWorld } from '@/worlds/registry';

/** Development, or a production build started with NEXT_PUBLIC_GHILAND_TEST_HOOKS=1. Off by default. */
export function devHooksEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_GHILAND_TEST_HOOKS === '1';
}

export interface WindowHookRecord {
  id: string;
  appId: string;
  state: string;
  mode: string;
  anchorId: string | null;
  minimized: boolean;
  pinTag: boolean;
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
      getGpuMemory: () => { bytes: number; textures: number; geometries: number; programs: number };
      getComposer: () => ReturnType<typeof readLiveComposer>;
      setPlayer: (snapshot: PlayerSnapshot) => void;
      runCameraPath: (stops: CameraStop[]) => () => void;
      setQuality: (quality: QualitySetting) => void;
      getPerf: () => {
        calls: number;
        triangles: number;
        textures: number;
        gpuMb: number;
        fps: number;
        frameMs: number;
      };
      setFakeFps: (fps: number | null) => void;
      getExposure: () => { exposure: number; zone: string };
      getRaySets: () => { placement: RayMember[]; occlusion: RayMember[]; crosshair: RayMember[] };
      getWindows: () => WindowHookRecord[];
      getCarryFrames: () => CarryFrame[];
      clearCarryFrames: () => void;
      injectMalformedPin: () => void;
      armQuotaError: () => void;
    };
  }
}

function pinTagPresent(id: string): boolean {
  if (typeof document === 'undefined') return false;
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
  return document.querySelector(`[data-ghiland-window="${escaped}"][data-pin-tag]`) !== null;
}

export function installDevHook(
  getCanvasMounts: () => number,
  getView?: () => { dpr: number; shadows: boolean; fov: number | null },
  getRendererInfo?: () => { textures: number; geometries: number; toneMapping: number; programs?: number },
): void {
  if (!devHooksEnabled()) {
    setCarryTrace(false);
    return;
  }
  setCarryTrace(true);
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
      const info = getRendererInfo?.() ?? { textures: 0, geometries: 0, toneMapping: 0, programs: 0 };
      return {
        bytes: readTrackedGpuBytes(),
        textures: info.textures,
        geometries: info.geometries,
        programs: info.programs ?? 0,
      };
    },
    getComposer: () => readLiveComposer(getRendererInfo?.().toneMapping ?? 0),
    runCameraPath: (stops) => runCameraPath(stops),
    setQuality: (quality) => useSettings.getState().setQuality(quality),
    getPerf: () => ({
      calls: perfSample.calls,
      triangles: perfSample.triangles,
      textures: perfSample.textures,
      gpuMb: perfSample.gpuMb,
      fps: perfSample.fps,
      frameMs: perfSample.frameMs,
    }),
    setFakeFps: (fps) => setFakeFps(fps),
    getExposure: () => ({ exposure: exposureSample.exposure, zone: exposureSample.zone }),
    getRaySets: () => {
      const id = useSession.getState().worldId;
      const world = id ? getWorld(id) : undefined;
      const colliders = world && world.collision.kind === 'boxes' ? world.collision.colliders : [];
      return raySetMembers(colliders);
    },
    getWindows: () =>
      Object.values(useWindows.getState().windows).map((item) => ({
        id: item.id,
        appId: item.appId,
        state: item.state,
        mode: item.mode.kind,
        anchorId: item.mode.kind === 'worldPinned' ? (item.mode.anchorId ?? null) : null,
        minimized: item.state === 'minimized',
        pinTag: pinTagPresent(item.id),
      })),
    getCarryFrames: () => readCarryFrames(),
    clearCarryFrames: () => clearCarryFrames(),
    injectMalformedPin: () => injectMalformedPin(),
    armQuotaError: () => armQuotaError(),
  };
}
