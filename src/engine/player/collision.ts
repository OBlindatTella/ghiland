import type { Collider } from '@/contracts/world';

export interface Body {
  radius: number;
  feetY: number;
  height: number;
}

interface Obstacle {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

const SKIN = 0.001;

function movementObstacles(colliders: readonly Collider[], body: Body): Obstacle[] {
  const feet = body.feetY;
  const head = body.feetY + body.height;
  const obstacles: Obstacle[] = [];
  for (const collider of colliders) {
    if (!collider.layers.includes('movement')) continue;
    const minY = collider.box.min[1];
    const maxY = collider.box.max[1];
    if (maxY <= feet || minY >= head) continue;
    obstacles.push({
      minX: collider.box.min[0],
      maxX: collider.box.max[0],
      minY,
      maxY,
      minZ: collider.box.min[2],
      maxZ: collider.box.max[2],
    });
  }
  return obstacles;
}

function pushOut(x: number, z: number, radius: number, boxes: readonly Obstacle[]): { x: number; z: number } {
  let cx = x;
  let cz = z;
  for (let pass = 0; pass < 4; pass += 1) {
    let hit = false;
    for (const box of boxes) {
      const minX = box.minX - radius;
      const maxX = box.maxX + radius;
      const minZ = box.minZ - radius;
      const maxZ = box.maxZ + radius;
      if (cx <= minX || cx >= maxX || cz <= minZ || cz >= maxZ) continue;
      const penLeft = cx - minX;
      const penRight = maxX - cx;
      const penDown = cz - minZ;
      const penUp = maxZ - cz;
      const minPen = Math.min(penLeft, penRight, penDown, penUp);
      if (minPen === penLeft) cx = minX - SKIN;
      else if (minPen === penRight) cx = maxX + SKIN;
      else if (minPen === penDown) cz = minZ - SKIN;
      else cz = maxZ + SKIN;
      hit = true;
    }
    if (!hit) break;
  }
  return { x: cx, z: cz };
}

function moveAxis(
  x: number,
  z: number,
  delta: number,
  radius: number,
  boxes: readonly Obstacle[],
  axis: 'x' | 'z',
): number {
  if (delta === 0) return axis === 'x' ? x : z;
  let allowed = delta;
  for (const box of boxes) {
    if (axis === 'x') {
      const minZ = box.minZ - radius;
      const maxZ = box.maxZ + radius;
      if (z <= minZ || z >= maxZ) continue;
      if (delta > 0) {
        const surface = box.minX - radius - SKIN;
        if (x <= surface && x + allowed > surface) allowed = surface - x;
      } else {
        const surface = box.maxX + radius + SKIN;
        if (x >= surface && x + allowed < surface) allowed = surface - x;
      }
    } else {
      const minX = box.minX - radius;
      const maxX = box.maxX + radius;
      if (x <= minX || x >= maxX) continue;
      if (delta > 0) {
        const surface = box.minZ - radius - SKIN;
        if (z <= surface && z + allowed > surface) allowed = surface - z;
      } else {
        const surface = box.maxZ + radius + SKIN;
        if (z >= surface && z + allowed < surface) allowed = surface - z;
      }
    }
  }
  return (axis === 'x' ? x : z) + allowed;
}

/**
 * Axis-separated AABB slide. Movement-layer colliders only, expanded by the capsule radius.
 * A step that would jump a thin wall stops on the near face instead of tunneling.
 */
export function slideMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
  body: Body,
  colliders: readonly Collider[],
): { x: number; z: number } {
  const boxes = movementObstacles(colliders, body);
  const freed = pushOut(x, z, body.radius, boxes);
  const nextX = moveAxis(freed.x, freed.z, dx, body.radius, boxes, 'x');
  const nextZ = moveAxis(nextX, freed.z, dz, body.radius, boxes, 'z');
  return pushOut(nextX, nextZ, body.radius, boxes);
}
