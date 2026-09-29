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

export interface PlacementBounds {
  min: Vec3;
  max: Vec3;
  floorY: number;
  ceilingY: number | null;
  railZ: number | null;
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
  reason?: 'tooClose';
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
    if (up) {
      const half = query.heightPx / PX_PER_METER / 2;
      const face = facingQuat(hit.point, eye);
      const yaw = Math.atan2(eye[0] - hit.point[0], eye[2] - hit.point[2]);
      const back = half * Math.sin(TABLE_TILT);
      const position: Vec3 = [
        hit.point[0] - Math.sin(yaw) * back,
        hit.point[1] + half * Math.cos(TABLE_TILT),
        hit.point[2] - Math.cos(yaw) * back,
      ];
      return containPlacement(
        withEyeCheck(
          {
            valid: true,
            taken,
            position,
            quaternion: mulQuat(face, pitchQuat(-TABLE_TILT)),
            placement: 'surface',
          },
          eye,
        ),
        query,
      );
    }
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
    );
  }

  let along = FLOAT_DISTANCE;
  if (hit) {
    const blocked = hit.collider.layers.includes('movement') && !hit.collider.layers.includes('pinSurface');
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

function containPlacement(placement: Placement, query: PlacementQuery): Placement {
  const bounds = query.bounds;
  if (!bounds || placement.placement === 'anchor') return placement;
  if (placement.placement === 'surface') return containOnSurface(placement, query, bounds);
  const halfH = query.heightPx / PX_PER_METER / 2;
  const halfW = (query.widthPx ?? 440) / PX_PER_METER / 2;
  let x = placement.position[0];
  let y = placement.position[1];
  let z = placement.position[2];
  const minX = bounds.min[0] + halfW + EDGE_CLEARANCE;
  const maxX = bounds.max[0] - halfW - EDGE_CLEARANCE;
  const minZ = bounds.min[2] + EDGE_CLEARANCE;
  let maxZ = bounds.max[2] - EDGE_CLEARANCE;
  if (bounds.railZ !== null) maxZ = Math.min(maxZ, bounds.railZ - RAIL_CLEARANCE);
  if (minX > maxX || minZ > maxZ) return { ...placement, valid: false };
  x = Math.min(maxX, Math.max(minX, x));
  z = Math.min(maxZ, Math.max(minZ, z));
  const minY = bounds.floorY + EDGE_CLEARANCE + halfH;
  if (bounds.ceilingY === null) y = Math.max(minY, y);
  else {
    const maxY = bounds.ceilingY - EDGE_CLEARANCE - halfH;
    if (minY > maxY) return { ...placement, position: [x, y, z], valid: false };
    y = Math.min(maxY, Math.max(minY, y));
  }
  return withEyeCheck({ ...placement, position: [x, y, z] }, query.ray.origin);
}

/** Slide a surface pin inside the volume without leaving the wall it was placed on. */
function containOnSurface(placement: Placement, query: PlacementQuery, bounds: PlacementBounds): Placement {
  const halfH = query.heightPx / PX_PER_METER / 2;
  const halfW = (query.widthPx ?? 440) / PX_PER_METER / 2;
  const right = rotateVec(placement.quaternion, [1, 0, 0]);
  const up = rotateVec(placement.quaternion, [0, 1, 0]);
  let alongRight = 0;
  let alongUp = 0;
  const minX = bounds.min[0];
  const maxX = bounds.max[0];
  const minZ = bounds.min[2];
  let maxZ = bounds.max[2];
  if (bounds.railZ !== null) maxZ = Math.min(maxZ, bounds.railZ - RAIL_CLEARANCE);
  const floor = bounds.floorY + EDGE_CLEARANCE;
  const ceiling = bounds.ceilingY === null ? null : bounds.ceilingY - EDGE_CLEARANCE;
  const corners: Array<[number, number]> = [
    [halfW, halfH],
    [halfW, -halfH],
    [-halfW, halfH],
    [-halfW, -halfH],
  ];
  for (let pass = 0; pass < 4; pass += 1) {
    for (const [sx, sy] of corners) {
      const corner = add(placement.position, add(scale(right, alongRight + sx), scale(up, alongUp + sy)));
      if (corner[1] < floor && Math.abs(up[1]) > 0.2) alongUp += (floor - corner[1]) / up[1];
      if (ceiling !== null && corner[1] > ceiling && Math.abs(up[1]) > 0.2) alongUp += (ceiling - corner[1]) / up[1];
      const nudges: Array<[0 | 2, number]> = [
        [0, corner[0] < minX ? minX - corner[0] : corner[0] > maxX ? maxX - corner[0] : 0],
        [2, corner[2] < minZ ? minZ - corner[2] : corner[2] > maxZ ? maxZ - corner[2] : 0],
      ];
      for (const [axis, delta] of nudges) {
        if (delta === 0) continue;
        const useRight = Math.abs(right[axis]) >= Math.abs(up[axis]);
        const component = useRight ? right[axis] : up[axis];
        if (Math.abs(component) < 0.2) continue;
        if (useRight) alongRight += delta / component;
        else alongUp += delta / component;
      }
    }
  }
  const position = add(placement.position, add(scale(right, alongRight), scale(up, alongUp)));
  return withEyeCheck({ ...placement, position }, query.ray.origin);
}

/**
 * Lock-loss landing (D-017). Always valid: a carried window is never dropped.
 * If the pose is past a movement collider, pull it back to the player's side.
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
  let position = pose;
  const hit = firstPlacementHit({ origin: eye, direction }, colliders.filter((item) => item.layers.includes('movement')));
  if (hit && hit.distance < span) {
    const along = Math.max(0.15, Math.min(span, hit.distance - GLASS_CLEARANCE));
    position = add(eye, scale(direction, along));
  }
  return containPlacement(
    {
      valid: true,
      taken: false,
      position,
      quaternion,
      placement: 'float',
    },
    {
      ray: { origin: eye, direction },
      colliders,
      anchors: [],
      occupied: new Set(),
      heightPx,
      bounds,
    },
  );
}

export function physicalSize(widthPx: number, heightPx: number): { w: number; h: number } {
  return { w: widthPx / PX_PER_METER, h: heightPx / PX_PER_METER };
}
