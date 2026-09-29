import type { ColliderLayer } from '@/contracts/world';

/** Placement ray: movement and placement colliders. Pin surfaces are classified after the hit. */
export function blocksPlacement(layers: readonly ColliderLayer[]): boolean {
  return layers.includes('movement') || layers.includes('placement');
}

/** Occlusion fade: the occluder layer only. Glass, curtains, and plants never occlude. */
export function blocksOcclusion(layers: readonly ColliderLayer[]): boolean {
  return layers.includes('occluder');
}

/** Crosshair and pick-up: walls and other occluders. Window quads are tested separately, out to 25 m. */
export function blocksCrosshair(layers: readonly ColliderLayer[]): boolean {
  return layers.includes('occluder');
}
