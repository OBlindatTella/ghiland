import type { Quat, Vec3 } from '@/contracts/math';

/** Neutral sun-faded wood. The back of a carried or pinned window, never a mirror of the DOM. */
export const FRAME_BACK_COLOR = '#B7A894';

/** Local +Z of a window quaternion. The readable face points along this normal (D-023). */
export function windowFrontNormal(quaternion: Quat): Vec3 {
  const [x, y, z, w] = quaternion;
  const tx = 2 * y;
  const ty = -2 * x;
  const cx = y * 0 - z * ty;
  const cy = z * tx - x * 0;
  const cz = x * ty - y * tx;
  return [w * tx + cx, w * ty + cy, 1 + cz];
}

/** True when `view` (camera toward the window) meets the front. dot(view, normal) < 0 (D-033). */
export function frontFacesView(normal: Vec3, view: Vec3): boolean {
  return normal[0] * view[0] + normal[1] * view[1] + normal[2] * view[2] < 0;
}

export const frameFaceStyle = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
} as const;

export const frameBackStyle = {
  position: 'absolute',
  inset: 0,
  borderRadius: 10,
  background: FRAME_BACK_COLOR,
  transform: 'rotateY(180deg)',
  pointerEvents: 'none',
  ...frameFaceStyle,
} as const;
