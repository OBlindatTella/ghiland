import type { AABB, Quat, Vec3 } from '@/contracts/math';
import type { ColliderLayer } from '@/contracts/world';
import { blocksPlacement } from '@/engine/windows/raySets';

/** Atlas pinned scale. Content is never scaled down (D-016). */
export const PX_PER_METER = 520;
export const CARRY_DISTANCE = 1.1;
export const PLACEMENT_RANGE = 3;
export const ANCHOR_RADIUS = 1.5;
export const MIN_EYE_DISTANCE = 0.7;
export const GLASS_CLEARANCE = 0.3;
export const FLOAT_DISTANCE = 1.6;
export const SURFACE_OFFSET = 0.01;
export const EDGE_CLEARANCE = 0.02;
export const RAIL_CLEARANCE = 0.15;

/** One walkable zone. The ceiling is that zone's own, not the tallest in the house (S6-07). */
export interface PlacementVolume {
  min: Vec3;
  max: Vec3;
  floorY: number;
  ceilingY: number | null;
}

/** Union of the walkable zones. A float may cross from one volume into the next (D-038). */
export interface PlacementBounds {
  volumes: readonly PlacementVolume[];
  floorY: number;
  railZ: number | null;
}

export function boundsFromBox(min: Vec3, max: Vec3, floorY: number, ceilingY: number | null, railZ: number | null): PlacementBounds {
  return { volumes: [{ min, max, floorY, ceilingY }], floorY, railZ };
}
export const TABLE_TILT = (10 * Math.PI) / 180;

export interface PlacementCollider {
  id: string;
  box: AABB;
  layers: readonly ColliderLayer[];
}

export interface PlacementAnchor {
  id: string;
  position: Vec3;
  quaternion: Quat;
}

export interface PlacementRay {
  origin: Vec3;
  direction: Vec3;
}

export interface PlacementHit {
  distance: number;
  point: Vec3;
  normal: Vec3;
  collider: PlacementCollider;
}

export interface Placement {
  valid: boolean;
  /** An anchor was in range but already held a window, so the rule fell through. */
  taken: boolean;
  position: Vec3;
  quaternion: Quat;
  placement: 'anchor' | 'surface' | 'float';
  anchorId?: string;
  reason?: 'tooClose' | 'outOfBounds';
}

export interface PlacementQuery {
  ray: PlacementRay;
  colliders: readonly PlacementCollider[];
  anchors: readonly PlacementAnchor[];
  occupied: ReadonlySet<string>;
  /** CSS pixel height, used so a table pose rests its bottom edge on the surface. */
  heightPx: number;
  widthPx?: number;
  bounds?: PlacementBounds;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function rotateVec(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(v, add(scale(t, q[3]), cross(u, t)));
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize(a: Vec3): Vec3 {
  const len = length(a) || 1;
  return scale(a, 1 / len);
}

function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function yawQuat(yaw: number): Quat {
  const half = yaw / 2;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

function pitchQuat(pitch: number): Quat {
  const half = pitch / 2;
  return [Math.sin(half), 0, 0, Math.cos(half)];
}

function mulQuat(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Upright window whose front (local +Z) points toward `target` on the horizontal plane. */
export function facingQuat(from: Vec3, target: Vec3, tiltBack = 0): Quat {
  const dx = target[0] - from[0];
  const dz = target[2] - from[2];
  const yaw = Math.atan2(dx, dz);
  const upright = yawQuat(yaw);
  if (tiltBack === 0) return upright;
  return mulQuat(upright, pitchQuat(-tiltBack));
}

export function quatFromNormal(normal: Vec3): Quat {
  const flat = Math.hypot(normal[0], normal[2]);
  if (flat < 1e-4) {
    return facingQuat([0, 0, 0], [0, 0, normal[1] >= 0 ? 1 : -1]);
  }
  return yawQuat(Math.atan2(normal[0], normal[2]));
}

/** Slab test. Returns the entry distance and face normal, or null. */
export function rayAabb(origin: Vec3, direction: Vec3, box: AABB, maxDistance: number): { distance: number; normal: Vec3 } | null {
  let tmin = 0;
  let tmax = maxDistance;
  let normalAxis = 0;
  let normalSign = 1;
  for (let axis = 0; axis < 3; axis += 1) {
    const start = origin[axis];
    const delta = direction[axis];
    const min = box.min[axis];
    const max = box.max[axis];
    if (Math.abs(delta) < 1e-8) {
      if (start < min || start > max) return null;
      continue;
    }
    let near = (min - start) / delta;
    let far = (max - start) / delta;
    let sign = -1;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
      sign = 1;
    }
    if (near > tmin) {
      tmin = near;
      normalAxis = axis;
      normalSign = sign;
    }
    tmax = Math.min(tmax, far);
    if (tmin > tmax) return null;
  }
  if (tmin < 0 || tmin > maxDistance) return null;
  const normal: Vec3 =
    normalAxis === 0 ? [normalSign, 0, 0] : normalAxis === 1 ? [0, normalSign, 0] : [0, 0, normalSign];
  return { distance: tmin, normal };
}

function stopsPlacement(collider: PlacementCollider): boolean {
  return blocksPlacement(collider.layers);
}

export function firstPlacementHit(ray: PlacementRay, colliders: readonly PlacementCollider[]): PlacementHit | null {
  const direction = normalize(ray.direction);
  let best: PlacementHit | null = null;
  for (const collider of colliders) {
    if (!stopsPlacement(collider)) continue;
    const hit = rayAabb(ray.origin, direction, collider.box, PLACEMENT_RANGE);
    if (!hit) continue;
    if (best && hit.distance >= best.distance) continue;
    best = {
      distance: hit.distance,
      point: add(ray.origin, scale(direction, hit.distance)),
      normal: hit.normal,
      collider,
    };
  }
  return best;
}

function withEyeCheck(placement: Placement, eye: Vec3): Placement {
  if (distance(placement.position, eye) >= MIN_EYE_DISTANCE) return placement;
  return { ...placement, valid: false, reason: 'tooClose' };
}

function nearestFreeAnchor(
  point: Vec3,
  anchors: readonly PlacementAnchor[],
  occupied: ReadonlySet<string>,
): { anchor: PlacementAnchor | null; taken: boolean } {
  let best: PlacementAnchor | null = null;
  let bestDistance = ANCHOR_RADIUS;
  let taken = false;
  for (const anchor of anchors) {
    const gap = distance(anchor.position, point);
    if (gap > ANCHOR_RADIUS) continue;
    if (occupied.has(anchor.id)) {
      taken = true;
      continue;
    }
    if (gap <= bestDistance) {
      best = anchor;
      bestDistance = gap;
    }
  }
  return { anchor: best, taken };
}

/**
 * One placement for the ghost and the pin (Atlas, D-016, D-021).
 * The ray stops at the first movement or placement collider.
 * A window centre closer than 0.7 m is invalid: the pose is still returned so the ghost can show it.
 */
export function resolvePlacement(query: PlacementQuery): Placement {
  const direction = normalize(query.ray.direction);
  const eye = query.ray.origin;
  const hit = firstPlacementHit({ origin: eye, direction }, query.colliders);
  const floatPoint = add(eye, scale(direction, FLOAT_DISTANCE));
  const sample = hit ? hit.point : floatPoint;
  const { anchor, taken } = nearestFreeAnchor(sample, query.anchors, query.occupied);
  if (anchor) {
    return withEyeCheck(
      {
        valid: true,
        taken: false,
        position: anchor.position,
        quaternion: anchor.quaternion,
        placement: 'anchor',
        anchorId: anchor.id,
      },
      eye,
    );
  }

  if (hit && hit.collider.layers.includes('pinSurface')) {
    const up = hit.normal[1] > 0.7;
    // Table side faces are not pin surfaces (Q13). Only an upward face, or a wall/fin (occluder), pins.
    if (up) {
      const half = query.heightPx / PX_PER_METER / 2;
      const face = facingQuat(hit.point, eye);
      const yaw = Math.atan2(eye[0] - hit.point[0], eye[2] - hit.point[2]);
      const back = half * Math.sin(TABLE_TILT);
      const position: Vec3 = [
        hit.point[0] - Math.sin(yaw) * back,
        hit.point[1] + EDGE_CLEARANCE + half * Math.cos(TABLE_TILT),
        hit.point[2] - Math.cos(yaw) * back,
      ];
      const posed = {
        valid: true,
        taken,
        position,
        quaternion: mulQuat(face, pitchQuat(-TABLE_TILT)),
        placement: 'surface' as const,
      };
      if (tableOverhangs(posed.position, posed.quaternion, half, (query.widthPx ?? 440) / PX_PER_METER / 2, hit.collider.box)) {
        return { ...posed, valid: false, reason: 'outOfBounds' };
      }
      return containPlacement(withEyeCheck(posed, eye), query, hit.collider.id);
    }
    if (hit.collider.layers.includes('occluder')) {
      const position = add(hit.point, scale(hit.normal, SURFACE_OFFSET));
      return containPlacement(
        withEyeCheck(
          {
            valid: true,
            taken,
            position,
            quaternion: quatFromNormal(hit.normal),
            placement: 'surface',
          },
          eye,
        ),
        query,
        hit.collider.id,
      );
    }
  }

  let along = FLOAT_DISTANCE;
  if (hit) {
    // A table side is movement, not a pin face, so the float stops 0.3 m short (Q13).
    const tableSide = hit.collider.layers.includes('pinSurface') && hit.normal[1] <= 0.7 && !hit.collider.layers.includes('occluder');
    const blocked = tableSide || (hit.collider.layers.includes('movement') && !hit.collider.layers.includes('pinSurface'));
    along = blocked ? Math.min(FLOAT_DISTANCE, hit.distance - GLASS_CLEARANCE) : Math.min(FLOAT_DISTANCE, Math.max(0.05, hit.distance - SURFACE_OFFSET));
  }
  const position = add(eye, scale(direction, along));
  return containPlacement(
    withEyeCheck(
      {
        valid: true,
        taken,
        position,
        quaternion: facingQuat(position, eye),
        placement: 'float',
      },
      eye,
    ),
    query,
  );
}

function containPlacement(placement: Placement, query: PlacementQuery, hostId?: string): Placement {
  const bounds = query.bounds;
  if (!bounds || placement.placement === 'anchor') return placement;
  if (placement.placement === 'surface') return containOnSurface(placement, query, bounds, hostId);
  return containInVolumes(placement, query, bounds);
}

function horizontalExtents(quaternion: Quat, halfW: number, halfH: number): { x: number; z: number } {
  const right = rotateVec(quaternion, [1, 0, 0]);
  const up = rotateVec(quaternion, [0, 1, 0]);
  return {
    x: Math.abs(right[0]) * halfW + Math.abs(up[0]) * halfH,
    z: Math.abs(right[2]) * halfW + Math.abs(up[2]) * halfH,
  };
}

function volumeInsets(volume: PlacementVolume, extentX: number, extentZ: number, railZ: number | null) {
  let maxZ = volume.max[2] - extentZ - EDGE_CLEARANCE;
  if (railZ !== null && volume.max[2] >= railZ - 0.05) maxZ = Math.min(maxZ, railZ - RAIL_CLEARANCE);
  return {
    minX: volume.min[0] + extentX + EDGE_CLEARANCE,
    maxX: volume.max[0] - extentX - EDGE_CLEARANCE,
    minZ: volume.min[2] + extentZ + EDGE_CLEARANCE,
    maxZ,
  };
}

function nearestInUnion(x: number, z: number, extentX: number, extentZ: number, bounds: PlacementBounds): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestDist = Infinity;
  for (const volume of bounds.volumes) {
    const inset = volumeInsets(volume, extentX, extentZ, bounds.railZ);
    if (inset.minX > inset.maxX + 1e-6 || inset.minZ > inset.maxZ + 1e-6) continue;
    const cx = Math.min(inset.maxX, Math.max(inset.minX, x));
    const cz = Math.min(inset.maxZ, Math.max(inset.minZ, z));
    const dist = (cx - x) ** 2 + (cz - z) ** 2;
    if (dist < bestDist - 1e-8) {
      bestDist = dist;
      best = { x: cx, z: cz };
    }
  }
  return best;
}

/** Lowest ceiling among the zone volumes the rectangle crosses. */
function ceilingFor(x: number, z: number, extentX: number, extentZ: number, bounds: PlacementBounds): number | null {
  let cap: number | null = null;
  for (const volume of bounds.volumes) {
    const overlaps =
      x + extentX > volume.min[0] &&
      x - extentX < volume.max[0] &&
      z + extentZ > volume.min[2] &&
      z - extentZ < volume.max[2];
    if (!overlaps || volume.ceilingY === null) continue;
    cap = cap === null ? volume.ceilingY : Math.min(cap, volume.ceilingY);
  }
  return cap;
}

function containInVolumes(placement: Placement, query: PlacementQuery, bounds: PlacementBounds): Placement {
  const halfH = query.heightPx / PX_PER_METER / 2;
  const halfW = (query.widthPx ?? 440) / PX_PER_METER / 2;
  const extent = horizontalExtents(placement.quaternion, halfW, halfH);
  const spot = nearestInUnion(placement.position[0], placement.position[2], extent.x, extent.z, bounds);
  if (!spot) return { ...placement, valid: false, reason: 'outOfBounds' };
  let y = placement.position[1];
  const floor = bounds.floorY + EDGE_CLEARANCE + halfH;
  const ceiling = ceilingFor(spot.x, spot.z, extent.x, extent.z, bounds);
  if (ceiling === null) y = Math.max(floor, y);
  else {
    const maxY = ceiling - EDGE_CLEARANCE - halfH;
    if (floor > maxY) return { ...placement, position: [spot.x, y, spot.z], valid: false, reason: 'outOfBounds' };
    y = Math.min(maxY, Math.max(floor, y));
  }
  return withEyeCheck({ ...placement, position: [spot.x, y, spot.z] }, query.ray.origin);
}

function tableOverhangs(position: Vec3, quaternion: Quat, halfH: number, halfW: number, box: AABB): boolean {
  const right = rotateVec(quaternion, [1, 0, 0]);
  const up = rotateVec(quaternion, [0, 1, 0]);
  const bottom = sub(position, scale(up, halfH));
  const limit = halfW * 2 * 0.1;
  for (const end of [add(bottom, scale(right, halfW)), add(bottom, scale(right, -halfW))]) {
    const dx = end[0] < box.min[0] ? box.min[0] - end[0] : end[0] > box.max[0] ? end[0] - box.max[0] : 0;
    const dz = end[2] < box.min[2] ? box.min[2] - end[2] : end[2] > box.max[2] ? end[2] - box.max[2] : 0;
    if (Math.hypot(dx, dz) > limit + 1e-4) return true;
  }
  return false;
}

function rectAabb(position: Vec3, right: Vec3, up: Vec3, halfW: number, halfH: number): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const sx of [halfW, -halfW]) {
    for (const sy of [halfH, -halfH]) {
      const corner = add(position, add(scale(right, sx), scale(up, sy)));
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis]!, corner[axis]!);
        max[axis] = Math.max(max[axis]!, corner[axis]!);
      }
    }
  }
  return { min, max };
}

/** Smallest push of interval A out of B. Null when they do not overlap. */
function axisSeparation(minA: number, maxA: number, minB: number, maxB: number): number | null {
  if (maxA <= minB + 1e-4 || minA >= maxB - 1e-4) return null;
  const pushPos = maxB - minA;
  const pushNeg = minB - maxA;
  return Math.abs(pushPos) <= Math.abs(pushNeg) ? pushPos : pushNeg;
}

/**
 * In-plane translation that clears `box` expanded by `margin`.
 * Null when the yawed footprint misses the box. A zero vector means the
 * overlap is only along the wall normal, so an in-plane push cannot fix it.
 */
function separateFromBox(
  position: Vec3,
  right: Vec3,
  up: Vec3,
  halfW: number,
  halfH: number,
  box: { min: Vec3; max: Vec3 },
  margin: number,
): { right: number; up: number } | null {
  const rect = rectAabb(position, right, up, halfW, halfH);
  const pushes = [0, 1, 2].map((axis) =>
    axisSeparation(rect.min[axis]!, rect.max[axis]!, box.min[axis]! - margin, box.max[axis]! + margin),
  );
  if (pushes.some((push) => push === null)) return null;
  const axes: Vec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  let best = Infinity;
  let alongRight = 0;
  let alongUp = 0;
  let found = false;
  for (let axis = 0; axis < 3; axis += 1) {
    const push = pushes[axis];
    if (push === null) continue;
    const world = scale(axes[axis]!, push);
    const slideRight = dot(world, right);
    const slideUp = dot(world, up);
    if (Math.hypot(slideRight, slideUp) < 1e-4) continue;
    if (Math.abs(push) < best) {
      best = Math.abs(push);
      alongRight = slideRight;
      alongUp = slideUp;
      found = true;
    }
  }
  if (!found) return { right: 0, up: 0 };
  return { right: alongRight, up: alongUp };
}

function footprintOverlaps(
  position: Vec3,
  right: Vec3,
  up: Vec3,
  halfW: number,
  halfH: number,
  box: { min: Vec3; max: Vec3 },
  margin: number,
): boolean {
  return separateFromBox(position, right, up, halfW, halfH, box, margin) !== null;
}

/**
 * Slide a wall pin along its own yaw so the whole footprint stays 1 cm off the
 * hit wall and 2 cm clear of every other movement or occluder box (S6-08, D-038).
 */
function containOnSurface(placement: Placement, query: PlacementQuery, bounds: PlacementBounds, hostId?: string): Placement {
  const halfH = query.heightPx / PX_PER_METER / 2;
  const halfW = (query.widthPx ?? 440) / PX_PER_METER / 2;
  const right = rotateVec(placement.quaternion, [1, 0, 0]);
  const up = rotateVec(placement.quaternion, [0, 1, 0]);
  const extent = horizontalExtents(placement.quaternion, halfW, halfH);
  const obstacles = query.colliders.filter(
    (collider) => collider.id !== hostId && (collider.layers.includes('movement') || collider.layers.includes('occluder')),
  );
  let alongRight = 0;
  let alongUp = 0;
  for (let pass = 0; pass < 8; pass += 1) {
    const position = add(placement.position, add(scale(right, alongRight), scale(up, alongUp)));
    const ceiling = ceilingFor(position[0], position[2], extent.x, extent.z, bounds);
    const floor = bounds.floorY + EDGE_CLEARANCE;
    const cap = ceiling === null ? null : ceiling - EDGE_CLEARANCE;
    let movedUp = 0;
    for (const sx of [halfW, -halfW]) {
      for (const sy of [halfH, -halfH]) {
        const corner = add(position, add(scale(right, sx), scale(up, movedUp + sy)));
        if (corner[1] < floor && Math.abs(up[1]) > 0.2) movedUp += (floor - corner[1]) / up[1];
        if (cap !== null && corner[1] > cap && Math.abs(up[1]) > 0.2) movedUp += (cap - corner[1]) / up[1];
      }
    }
    alongUp += movedUp;
    const slid = add(placement.position, add(scale(right, alongRight), scale(up, alongUp)));
    let shifted = Math.abs(movedUp) > 1e-6;
    for (const obstacle of obstacles) {
      const sep = separateFromBox(slid, right, up, halfW, halfH, obstacle.box, EDGE_CLEARANCE);
      if (!sep || (Math.abs(sep.right) < 1e-6 && Math.abs(sep.up) < 1e-6)) continue;
      alongRight += sep.right;
      alongUp += sep.up;
      shifted = true;
      break;
    }
    if (!shifted) break;
  }
  const position = add(placement.position, add(scale(right, alongRight), scale(up, alongUp)));
  for (const obstacle of obstacles) {
    if (footprintOverlaps(position, right, up, halfW, halfH, obstacle.box, EDGE_CLEARANCE)) {
      return { ...placement, position, valid: false, reason: 'outOfBounds' };
    }
  }
  return withEyeCheck({ ...placement, position }, query.ray.origin);
}

/** One volume per walkable zone, each with its own ceiling. The corridor stays at 2.4 m (S6-07, D-038). */
export function unionPlacementBounds(
  zones: readonly { bounds: readonly { min: Vec3; max: Vec3 }[] }[],
  floorY: number,
  railZ: number | null,
): PlacementBounds {
  const volumes: PlacementVolume[] = [];
  for (const zone of zones) {
    for (const box of zone.bounds) {
      volumes.push({
        min: [box.min[0], box.min[1], box.min[2]],
        max: [box.max[0], box.max[1], box.max[2]],
        floorY,
        ceilingY: box.max[1],
      });
    }
  }
  if (volumes.length === 0) return boundsFromBox([-7, floorY, -9], [7, 3.2, 9], floorY, 3.2, railZ);
  return { volumes, floorY, railZ };
}

/**
 * Lock-loss landing (D-017, D-038). The nearest float along the view ray that
 * stays at least 0.7 m out and inside the walkable union. Invalid when none exists;
 * the caller docks the window back to the Screen instead of dropping it.
 */
export function autoPinPlacement(
  eye: Vec3,
  pose: Vec3,
  quaternion: Quat,
  colliders: readonly PlacementCollider[],
  bounds?: PlacementBounds,
  heightPx = 560,
): Placement {
  const delta = sub(pose, eye);
  const span = length(delta);
  const direction = span > 1e-4 ? scale(delta, 1 / span) : ([0, 0, -1] as Vec3);
  const hit = firstPlacementHit({ origin: eye, direction }, colliders.filter((item) => item.layers.includes('movement')));
  const limit = hit ? Math.max(0, hit.distance - GLASS_CLEARANCE) : Math.max(span, FLOAT_DISTANCE);
  const preferred = hit && hit.distance < span ? Math.min(span, limit) : Math.min(Math.max(span, MIN_EYE_DISTANCE), limit);
  const query = {
    ray: { origin: eye, direction },
    colliders,
    anchors: [] as PlacementAnchor[],
    occupied: new Set<string>(),
    heightPx,
    bounds,
  };
  const placeAt = (along: number) =>
    withEyeCheck(
      containPlacement(
        {
          valid: true,
          taken: false,
          position: add(eye, scale(direction, Math.max(0, along))),
          quaternion,
          placement: 'float',
        },
        query,
      ),
      eye,
    );
  const fallback = placeAt(preferred);
  if (fallback.valid && preferred >= MIN_EYE_DISTANCE - 1e-4) return fallback;
  for (let along = Math.min(limit, FLOAT_DISTANCE); along >= MIN_EYE_DISTANCE - 1e-4; along -= 0.15) {
    const placed = placeAt(along);
    if (placed.valid) return placed;
  }
  return { ...fallback, valid: false, reason: fallback.reason ?? 'outOfBounds' };
}

export function physicalSize(widthPx: number, heightPx: number): { w: number; h: number } {
  return { w: widthPx / PX_PER_METER, h: heightPx / PX_PER_METER };
}
