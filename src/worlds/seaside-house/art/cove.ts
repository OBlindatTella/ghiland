/** Cove pieces. None of these are colliders or ray-set members (D-032). */

export interface PlacedModel {
  asset: 'coastal_cliff_02' | 'coastal_cliff_01' | 'coastal_cliff_04' | 'coast_rocks_05' | 'coast_land_rocks_03';
  position: [number, number, number];
  /** Euler XYZ in radians. Three applies Z, then Y, then X. */
  rotation: [number, number, number];
  scale: [number, number, number];
}

const LEFT_YAW = -1.089;
const RIGHT_YAW = -2.29;

/** Cliff under the terrace. Face toward +Z, base at y −10.3, waterline near z 7. */
export const CLIFF_UNDER: PlacedModel = {
  asset: 'coastal_cliff_02',
  position: [0, -10.072, 2.847],
  rotation: [0, 0, 0],
  scale: [1.25, 1, 1],
};

/** +X arm, face toward the cove. Top near the house is about y −1. */
export const COVE_ARM_LEFT: PlacedModel = {
  asset: 'coastal_cliff_01',
  position: [23, -9.715, 24],
  rotation: [0, LEFT_YAW, -0.069],
  scale: [0.55, 0.9, 0.9],
};

/** −X arm, mirrored so the face still points into the cove. */
export const COVE_ARM_RIGHT: PlacedModel = {
  asset: 'coastal_cliff_01',
  position: [-23, -9.82, 12],
  rotation: [0, RIGHT_YAW, 0.07],
  scale: [-0.45, 0.8, 0.8],
};

export const BOULDERS: readonly PlacedModel[] = [
  { asset: 'coast_rocks_05', position: [7, -6.2, 9], rotation: [0, 0.4, 0], scale: [1.15, 1.15, 1.15] },
  { asset: 'coast_rocks_05', position: [-6.5, -6.2, 8.5], rotation: [0, 1.2, 0], scale: [0.9, 0.9, 0.9] },
  { asset: 'coast_rocks_05', position: [12.5, -6.4, 12], rotation: [0, 2.1, 0], scale: [1.4, 1.4, 1.4] },
  { asset: 'coast_rocks_05', position: [-15, -6.4, 10], rotation: [0, 0.7, 0], scale: [1.05, 1.05, 1.05] },
  { asset: 'coast_rocks_05', position: [18, -6.5, 22], rotation: [0, 2.6, 0], scale: [1.55, 1.55, 1.55] },
  { asset: 'coast_rocks_05', position: [-22, -6.5, 16], rotation: [0, 1.8, 0], scale: [0.85, 0.85, 0.85] },
];

export const WET_SHELVES: readonly PlacedModel[] = [
  { asset: 'coast_land_rocks_03', position: [-3, -6.9, 7.5], rotation: [0, (15 * Math.PI) / 180, 0], scale: [1, 1, 1] },
  { asset: 'coast_land_rocks_03', position: [8, -6.9, 9.5], rotation: [0, (-40 * Math.PI) / 180, 0], scale: [1, 1, 1] },
];

/** Local bounding box of coastal_cliff_01, metres. */
const CLIFF_01_MIN: [number, number, number] = [-45.06, -0.65, -6.21];
const CLIFF_01_MAX: [number, number, number] = [46.92, 9.68, 4.76];

function transformCorner(piece: PlacedModel, local: [number, number, number]): [number, number, number] {
  const [rx, ry, rz] = piece.rotation;
  const x = local[0] * piece.scale[0];
  const y = local[1] * piece.scale[1];
  const z = local[2] * piece.scale[2];
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const x1 = x * cz - y * sz;
  const y1 = x * sz + y * cz;
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x2 = x1 * cy + z * sy;
  const z2 = -x1 * sy + z * cy;
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y2 = y1 * cx - z2 * sx;
  const z3 = y1 * sx + z2 * cx;
  return [x2 + piece.position[0], y2 + piece.position[1], z3 + piece.position[2]];
}

/** Every corner of the right arm stays on the −X side of the glitter lane. */
export function rightArmStaysOffGlitter(): boolean {
  const corners: [number, number, number][] = [];
  for (const x of [CLIFF_01_MIN[0], CLIFF_01_MAX[0]]) {
    for (const y of [CLIFF_01_MIN[1], CLIFF_01_MAX[1]]) {
      for (const z of [CLIFF_01_MIN[2], CLIFF_01_MAX[2]]) corners.push([x, y, z]);
    }
  }
  return corners.every((corner) => {
    const [x, , z] = transformCorner(COVE_ARM_RIGHT, corner);
    return x < -0.7 * (z + 3);
  });
}
