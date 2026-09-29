/** Inward billow, pinned at the top rail. Never past 0.35 m, and almost no sideways travel. */
export function curtainBillow(uvY: number, time: number, uvX: number): { z: number; x: number } {
  const hem = 1 - uvY;
  const gust = 0.2 + 0.15 * Math.sin(time * 0.65 + uvX * 5);
  const z = Math.min(0.35, Math.max(0, hem * hem * gust));
  const flutter = Math.sin(time * 1.6 + uvY * 8) * hem * 0.018;
  const x = Math.min(0.02, Math.max(-0.02, flutter));
  return { z, x };
}

export const CURTAIN_BILLOW_MAX = 0.35;
