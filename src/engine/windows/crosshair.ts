import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector2,
  type Camera,
} from 'three';

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

/** Centre-of-screen ray against window quads. Empty list returns null. */
export function raycastCrosshair(camera: Camera, quads: readonly WindowQuad[]): string | null {
  raycaster.setFromCamera(ndc, camera);
  let closest: { id: string; distance: number } | null = null;
  for (const quad of quads) {
    mesh.position.set(quad.position[0], quad.position[1], quad.position[2]);
    mesh.quaternion.set(quad.quaternion[0], quad.quaternion[1], quad.quaternion[2], quad.quaternion[3]);
    mesh.scale.set(quad.half.w * 2, quad.half.h * 2, 1);
    mesh.updateMatrixWorld(true);
    const hit = raycaster.intersectObject(mesh, false)[0];
    if (hit && (closest === null || hit.distance < closest.distance)) {
      closest = { id: quad.id, distance: hit.distance };
    }
  }
  return closest?.id ?? null;
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

export function queryCrosshair(): string | null {
  if (!cameraRef) return null;
  return raycastCrosshair(cameraRef, quads);
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
