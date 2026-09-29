/**
 * Orthographic shadow fit for the house and terrace (about ±7 × ±9 m around the
 * light target). ±10 m in light space keeps floor texels near 5 cm at 12° sun
 * on a 2048 map. three r186 maps PCFSoftShadowMap to PCF.
 */
export const shadowFrustum = {
  left: -10,
  right: 10,
  top: 10,
  bottom: -10,
  near: 8,
  far: 70,
  bias: -0.00045,
  normalBias: 0.045,
} as const;

export function shadowCoversHouse(): boolean {
  const width = shadowFrustum.right - shadowFrustum.left;
  const height = shadowFrustum.top - shadowFrustum.bottom;
  return width >= 20 && width <= 24 && height >= 20 && shadowFrustum.near < 16 && shadowFrustum.far > 50 && shadowFrustum.left <= -10;
}
