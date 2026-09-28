import { queuePlayerTransform } from '@/engine/player/playerCommand';

export interface CameraStop {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch?: number;
  holdMs?: number;
}

/** Queues player transforms along a scripted path. The controller applies each one on the next frame. */
export function runCameraPath(stops: readonly CameraStop[]): () => void {
  let cancelled = false;
  let timer = 0;
  let index = 0;
  const step = () => {
    if (cancelled) return;
    const stop = stops[index];
    if (!stop) return;
    index += 1;
    queuePlayerTransform({
      x: stop.x,
      y: stop.y,
      z: stop.z,
      yaw: stop.yaw,
      pitch: stop.pitch ?? 0,
    });
    if (index >= stops.length) return;
    const hold = stop.holdMs ?? 0;
    if (hold <= 0) {
      step();
      return;
    }
    timer = globalThis.setTimeout(step, hold) as unknown as number;
  };
  step();
  return () => {
    cancelled = true;
    globalThis.clearTimeout(timer);
  };
}
