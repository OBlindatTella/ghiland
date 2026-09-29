export interface RockPlacement {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
}

/** Waterline boulders. Foam rings use the same xz. Not a collider. */
export function rockLayout(): RockPlacement[] {
  const spec: Array<[number, number, number, number, number]> = [
    [7, -6.2, 9, 0.4, 1.15],
    [-6.5, -6.2, 8.5, 1.2, 0.9],
    [12.5, -6.4, 12, 2.1, 1.4],
    [-15, -6.4, 10, 0.7, 1.05],
    [18, -6.5, 22, 2.6, 1.55],
    [-22, -6.5, 16, 1.8, 0.85],
  ];
  return spec.map(([x, y, z, yaw, scale]) => ({
    position: [x, y, z],
    scale: [scale, scale, scale],
    rotation: [0, yaw, 0],
  }));
}

/** Foam hints: xz centre, radius, phase. One ring per boulder. */
export const FOAM_ROCKS: readonly [number, number, number, number][] = rockLayout().map((rock, index) => [
  rock.position[0],
  rock.position[2],
  3.2 + rock.scale[0],
  index * 0.7,
]);
