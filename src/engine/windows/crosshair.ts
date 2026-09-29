import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
} from 'three';
import type { AABB } from '@/contracts/math';

export interface WindowQuad {
  id: string;
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  /** Half extents of the quad in metres. */
  half: { w: number; h: number };
}

const raycaster = new Raycaster();
const ndc = new Vector2(0, 0);
const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ side: DoubleSide }));

/** E pick-up and the crosshair both stop at 25 m. */
export const CROSSHAIR_RANGE = 25;

const blockers: AABB[] = [];

function rayBoxDistance(originX: number, originY: number, originZ: number, dirX: number, dirY: number, dirZ: number, box: AABB): number | null {
  const origin = [originX, originY, originZ];
  const dir = [dirX, dirY, dirZ];
  let tmin = 0;
  let tmax = CROSSHAIR_RANGE;
  for (let axis = 0; axis < 3; axis += 1) {
    const min = box.min[axis] ?? 0;
    const max = box.max[axis] ?? 0;
    const direction = dir[axis] ?? 0;
    const start = origin[axis] ?? 0;
    if (Math.abs(direction) < 1e-8) {
      if (start < min || start > max) return null;
      continue;
    }
    let near = (min - start) / direction;
    let far = (max - start) / direction;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    tmin = Math.max(tmin, near);
    tmax = Math.min(tmax, far);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Centre-of-screen ray against window quads. Occluders win. Empty list returns null. */
export function raycastCrosshair(
  camera: Camera,
  quads: readonly WindowQuad[],
  obstacles: readonly AABB[] = blockers,
  far = CROSSHAIR_RANGE,
): string | null {
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = far;
  const origin = raycaster.ray.origin;
  const dir = raycaster.ray.direction;
  let blocked = far;
  for (const box of obstacles) {
    const distance = rayBoxDistance(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, box);
    if (distance !== null && distance < blocked) blocked = distance;
  }
  let closest: { id: string; distance: number } | null = null;
  for (const quad of quads) {
    mesh.position.set(quad.position[0], quad.position[1], quad.position[2]);
    mesh.quaternion.set(quad.quaternion[0], quad.quaternion[1], quad.quaternion[2], quad.quaternion[3]);
    mesh.scale.set(quad.half.w * 2, quad.half.h * 2, 1);
    mesh.updateMatrixWorld(true);
    const hit = raycaster.intersectObject(mesh, false)[0];
    if (!hit || hit.distance > far || hit.distance >= blocked) continue;
    if (closest === null || hit.distance < closest.distance) closest = { id: quad.id, distance: hit.distance };
  }
  return closest?.id ?? null;
}

export function registerRayBlockers(boxes: readonly AABB[]): () => void {
  blockers.push(...boxes);
  return () => {
    for (const box of boxes) {
      const index = blockers.indexOf(box);
      if (index >= 0) blockers.splice(index, 1);
    }
  };
}

const quads: WindowQuad[] = [];
let cameraRef: Camera | null = null;
const listeners = new Set<(id: string) => void>();

export function bindCrosshairCamera(camera: Camera | null): void {
  cameraRef = camera;
}

export function registerWindowQuad(quad: WindowQuad): () => void {
  quads.push(quad);
  return () => {
    const index = quads.indexOf(quad);
    if (index >= 0) quads.splice(index, 1);
  };
}

export function setWindowQuads(next: readonly WindowQuad[]): void {
  quads.length = 0;
  quads.push(...next);
}

export function cameraPose(): {
  origin: [number, number, number];
  direction: [number, number, number];
  quaternion: [number, number, number, number];
} | null {
  if (!cameraRef) return null;
  cameraRef.updateMatrixWorld();
  const direction = new Vector3();
  cameraRef.getWorldDirection(direction);
  const origin = cameraRef.position;
  const quaternion = cameraRef.quaternion;
  return {
    origin: [origin.x, origin.y, origin.z],
    direction: [direction.x, direction.y, direction.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
}

export function queryCrosshair(): string | null {
  if (!cameraRef) return null;
  return raycastCrosshair(cameraRef, quads, blockers);
}

export function notifyCrosshairClick(): string | null {
  const id = queryCrosshair();
  if (!id) return null;
  for (const listener of listeners) listener(id);
  return id;
}

export function onCrosshairHit(listener: (id: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
