/**
 * Orthographic shadow fit for the house and terrace (about 16 × 20 m) plus the
 * cliff rocks. The default ±5 m camera clipped the sun. Low elevation stretches
 * the footprint, so the frustum is 44 m across.
 */
export const shadowFrustum = {
  left: -22,
  right: 22,
  top: 22,
  bottom: -22,
  near: 8,
  far: 70,
  bias: -0.00045,
  normalBias: 0.045,
} as const;

export function shadowCoversHouse(): boolean {
  const width = shadowFrustum.right - shadowFrustum.left;
  const height = shadowFrustum.top - shadowFrustum.bottom;
  return width >= 36 && height >= 36 && shadowFrustum.near < 16 && shadowFrustum.far > 50 && shadowFrustum.left < -5;
}
