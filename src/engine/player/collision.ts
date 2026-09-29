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

const FACE_EPS = 0.02;

/** True when another box keeps this face going past the corner, so the corner is not an opening. */
function faceContinuesPast(
  box: Obstacle,
  boxes: readonly Obstacle[],
  side: 'minX' | 'maxX',
  face: 'minZ' | 'maxZ',
): boolean {
  const faceZ = face === 'minZ' ? box.minZ : box.maxZ;
  const edgeX = side === 'minX' ? box.minX : box.maxX;
  for (const other of boxes) {
    if (other === box) continue;
    const otherZ = face === 'minZ' ? other.minZ : other.maxZ;
    if (Math.abs(otherZ - faceZ) > FACE_EPS) continue;
    if (side === 'minX') {
      if (other.maxX >= edgeX - FACE_EPS && other.minX < edgeX - FACE_EPS) return true;
    } else if (other.minX <= edgeX + FACE_EPS && other.maxX > edgeX + FACE_EPS) return true;
  }
  return false;
}

/**
 * When this step's Z hits a face because X just entered an opening corner,
 * put X back outside that corner so Z can slide past. The capsule has to be
 * meeting the face (Z was shortened). A strafe that never reaches the slab
 * is left alone. An inner corner shared with a coplanar neighbour is not an opening.
 *
 * Vestigial after S5-01/S5-02 (S6-15): the shift is capped at this frame's
 * lateral step and rejected if it would enter another padded box, so it changes
 * the outcome by less than one step. It stays so a junction cannot dead-stop.
 */
/** True when (x, z) sits inside a radius-expanded movement box, not merely on its skin. */
function insidePadded(x: number, z: number, radius: number, boxes: readonly Obstacle[]): boolean {
  for (const box of boxes) {
    if (x <= box.minX - radius || x >= box.maxX + radius || z <= box.minZ - radius || z >= box.maxZ + radius) continue;
    return true;
  }
  return false;
}

function releaseOpeningEdge(
  x: number,
  z: number,
  nextX: number,
  dx: number,
  dz: number,
  radius: number,
  boxes: readonly Obstacle[],
): number | null {
  if (dz === 0 || dx === 0) return null;
  const reach = radius * radius;
  let best: number | null = null;
  let bestReach = reach;
  for (const box of boxes) {
    const minX = box.minX - radius;
    const maxX = box.maxX + radius;
    const minZ = box.minZ - radius;
    const maxZ = box.maxZ + radius;
    if (nextX <= minX || nextX >= maxX) continue;
    const approachingSouth = dz > 0 && z <= minZ + FACE_EPS;
    const approachingNorth = dz < 0 && z >= maxZ - FACE_EPS;
    if (!approachingSouth && !approachingNorth) continue;
    const distLeft = Math.abs(Math.min(x, nextX) - minX);
    const distRight = Math.abs(Math.max(x, nextX) - maxX);
    const side: 'minX' | 'maxX' = distLeft <= distRight ? 'minX' : 'maxX';
    const edgeX = side === 'minX' ? minX : maxX;
    if (side === 'minX' && x > edgeX + radius) continue;
    if (side === 'maxX' && x < edgeX - radius) continue;
    const face = approachingSouth ? 'minZ' : 'maxZ';
    if (faceContinuesPast(box, boxes, side, face)) continue;
    let released = side === 'minX' ? minX - SKIN : maxX + SKIN;
    const shift = released - x;
    // Only toward the input, and never farther than this frame's lateral step.
    if (shift * dx <= 0) continue;
    if (Math.abs(shift) > Math.abs(dx)) released = x + dx;
    // A release that starts inside another padded box is undone by pushOut and freezes the step.
    if (insidePadded(released, z, radius, boxes)) continue;
    const edgeZ = approachingSouth ? minZ : maxZ;
    const lx = x - edgeX;
    const lz = z - edgeZ;
    const dist = lx * lx + lz * lz;
    if (dist > bestReach) continue;
    bestReach = dist;
    best = released;
  }
  return best;
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
  releaseEdges = true,
): { x: number; z: number } {
  const boxes = movementObstacles(colliders, body);
  const freed = pushOut(x, z, body.radius, boxes);
  let nextX = moveAxis(freed.x, freed.z, dx, body.radius, boxes, 'x');
  let nextZ = moveAxis(nextX, freed.z, dz, body.radius, boxes, 'z');
  if (releaseEdges && dz !== 0 && Math.abs(nextZ - (freed.z + dz)) > 1e-6) {
    const released = releaseOpeningEdge(freed.x, freed.z, nextX, dx, dz, body.radius, boxes);
    if (released !== null && !insidePadded(released, freed.z, body.radius, boxes)) {
      const retryZ = moveAxis(released, freed.z, dz, body.radius, boxes, 'z');
      const landed = pushOut(released, retryZ, body.radius, boxes);
      const pushUndoes = Math.abs(landed.x - released) > 1e-4 || Math.abs(landed.z - retryZ) > 1e-4;
      if (!pushUndoes && Math.abs(retryZ - freed.z) > Math.abs(nextZ - freed.z) + 1e-6) {
        nextX = released;
        nextZ = retryZ;
      }
    }
  }
  return pushOut(nextX, nextZ, body.radius, boxes);
}
