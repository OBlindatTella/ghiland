export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export interface AABB {
  min: Vec3;
  max: Vec3;
}

/** CSS pixels, viewport-relative. */
export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
