import type { AABB } from '@/contracts/math';
import type { Collider, ColliderLayer, CollisionSpec } from '@/contracts/world';
import { furnitureColliders } from './furniture';

export interface LevelBox {
  id: string;
  box: AABB;
  layers: ColliderLayer[];
  color: string;
  opacity: number;
}

const T = 0.15;

function box(
  id: string,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  layers: ColliderLayer[],
  color: string,
  opacity = 1,
): LevelBox {
  return {
    id,
    box: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
    layers,
    color,
    opacity,
  };
}

const wall: ColliderLayer[] = ['movement', 'occluder', 'pinSurface'];
const glass: ColliderLayer[] = ['movement'];
const surface: ColliderLayer[] = ['placement'];
const visual: ColliderLayer[] = [];

/**
 * Seaside House greybox in three.js coordinates (D-019): metres, Y up, +Z toward the sea.
 * Facing +Z, the viewer's left is +X. Aura's authored X values are negated.
 * Origin is the centre of the living-room back wall (z = -3.5).
 * Spawn (0, 1.62, -8.2) faces +Z. Open panels are the centre pair, x −2…+2 (D-025).
 * Closed panels are x −6…−2 and +2…+6.
 */
export const SPAWN: { x: number; y: number; z: number } = { x: 0, y: 1.62, z: -8.2 };
export const SEA_Y = -6;

const corridorFloor = '#8C7356';
const corridorWall = '#6E5E4C';
const corridorCeiling = '#5A4C3E';
const livingFloor = '#C4A574';
const livingWall = '#E6D9C8';
const livingCeiling = '#EFE6DA';
const finColor = '#D4C6B4';
const terraceFloor = '#A89070';
const glassColor = '#C5DDE0';
const railColor = '#D7E6E8';
const smokedOak = '#4A3B2E';
const linen = '#E4D2B8';

export const levelBoxes: readonly LevelBox[] = [
  box('corridor-floor', -1.1, -0.06, -9, 1.1, 0.002, -3.5, surface, corridorFloor),
  box('corridor-ceiling', -1.1, 2.4, -9, 1.1, 2.52, -3.5, surface, corridorCeiling),
  box('corridor-west', -1.1 - T, 0, -9, -1.1, 2.4, -3.5, wall, corridorWall),
  box('corridor-east', 1.1, 0, -9, 1.1 + T, 2.4, -3.5, wall, corridorWall),
  box('corridor-south', -1.1 - T, 0, -9 - T, 1.1 + T, 2.4, -9, wall, corridorWall),

  box('living-floor', -7, -0.06, -3.5, 7, 0.002, 4.5, surface, livingFloor),
  box('living-ceiling', -7, 3.2, -3.5, 7, 3.34, 4.5, surface, livingCeiling),
  box('living-west', -7 - T, 0, -3.5, -7, 3.2, 4.5, wall, livingWall),
  box('living-east', 7, 0, -3.5, 7 + T, 3.2, 4.5, wall, livingWall),
  box('living-back-west', -7 - T, 0, -3.5 - T, -1.1, 3.2, -3.5, wall, livingWall),
  box('living-back-east', 1.1, 0, -3.5 - T, 7 + T, 3.2, -3.5, wall, livingWall),
  box('living-header', -1.1, 2.4, -3.5 - T, 1.1, 3.2, -3.5, wall, livingWall),
  // D-027. Underside at 2.10 m, above the 1.75 m capsule, so it frames the mouth and does not block the walk.
  box('soffit', -1.1, 2.1, -4.4, 1.1, 2.42, -3.5, visual, smokedOak),
  // Travertine returns sit on the existing wall ends. Visual only, so they do not narrow the walk.
  box('jamb-west', -1.28, 0, -3.64, -1.1, 2.4, -3.36, visual, '#E4D3BE'),
  box('jamb-east', 1.1, 0, -3.64, 1.28, 2.4, -3.36, visual, '#E4D3BE'),

  // D-020: expanded by the 0.3 m radius, this stays outside x −2…+2 and off the open panels.
  box('fin', -7, 0, -3.25, -2.35, 2.8, -2.8, wall, finColor),

  box('pier-west', -7, 0, 4.38, -6, 3.2, 4.62, wall, livingWall),
  box('pier-east', 6, 0, 4.38, 7, 3.2, 4.62, wall, livingWall),
  box('glass-closed-west-outer', -6, 0, 4.47, -4, 3.2, 4.53, glass, glassColor, 0.2),
  box('glass-closed-west', -4, 0, 4.47, -2, 3.2, 4.53, glass, glassColor, 0.2),
  box('glass-closed-east', 2, 0, 4.47, 4, 3.2, 4.53, glass, glassColor, 0.2),
  box('glass-closed-east-outer', 4, 0, 4.47, 6, 3.2, 4.53, glass, glassColor, 0.2),

  box('terrace-floor', -7, -0.06, 4.5, 7, 0.002, 9, surface, terraceFloor),
  box('rail-north', -7, 0, 9, 7, 1.05, 9.06, glass, railColor, 0.32),
  box('rail-west', -7, 0, 4.5, -6.94, 1.05, 9, glass, railColor, 0.32),
  box('rail-east', 7, 0, 4.5, 7.06, 1.05, 9, glass, railColor, 0.32),
  box('rail-cap-north', -7, 1.02, 8.98, 7, 1.08, 9.08, visual, '#F2EFE8'),
  // Placeholder curtains. Visual only: they never occlude and never block movement (D-027).
  box('curtain-left', 1.8, 0.05, 4.24, 2.6, 3.15, 4.36, visual, linen, 0.42),
  box('curtain-right', -2.6, 0.05, 4.24, -1.8, 3.15, 4.36, visual, linen, 0.42),
];

export const seasideColliders: readonly Collider[] = [
  ...levelBoxes.filter((item) => item.layers.length > 0).map((item) => ({ id: item.id, box: item.box, layers: item.layers })),
  ...furnitureColliders,
];

export const seasideCollision: CollisionSpec = {
  kind: 'boxes',
  walkable: { min: [-7, 0, -9], max: [7, 0, 9] },
  colliders: [...seasideColliders],
  floorY: 0,
};
