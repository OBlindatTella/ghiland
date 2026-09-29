let fakeFps: number | null = null;

/** `null` clears the injection and AUTO reads the live frame time again. */
export function setFakeFps(fps: number | null): void {
  if (fps === null) {
    fakeFps = null;
    return;
  }
  fakeFps = Number.isFinite(fps) ? fps : null;
}

export function readFps(live: number): { fps: number; injected: boolean } {
  if (fakeFps === null) return { fps: live, injected: false };
  return { fps: fakeFps, injected: true };
}
