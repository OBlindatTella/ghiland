import type { AABB } from '@/contracts/math';
import type { AcousticPortal, WorldZone } from '@/contracts/environment';

export function zoneAt(x: number, y: number, z: number, zones: readonly WorldZone[]): WorldZone | null {
  let found: WorldZone | null = null;
  for (const zone of zones) {
    const inside = zone.bounds.some(
      (box) =>
        x >= box.min[0] && x <= box.max[0] && y >= box.min[1] && y <= box.max[1] && z >= box.min[2] && z <= box.max[2],
    );
    if (inside) found = zone;
  }
  return found;
}

/** Distance to the nearest open portal opening, measured in the horizontal plane. */
export function distanceToOpenPortal(x: number, z: number, portals: readonly AcousticPortal[]): number {
  const open = portals.filter((portal) => portal.open);
  if (open.length === 0) return Infinity;
  return Math.min(...open.map((portal) => distanceToAabb(x, z, portal.bounds)));
}

function distanceToAabb(x: number, z: number, box: AABB): number {
  const cx = Math.min(box.max[0], Math.max(box.min[0], x));
  const cz = Math.min(box.max[2], Math.max(box.min[2], z));
  return Math.hypot(x - cx, z - cz);
}

/** Exterior is open. Indoors, cutoff falls from nearHz at the portal to farHz at farDistance. */
export function occlusionCutoff(
  distance: number,
  nearHz: number,
  farHz: number,
  farDistance: number,
  exterior: boolean,
): number {
  if (exterior) return 18000;
  const span = Math.max(0.001, farDistance);
  const t = Math.min(1, Math.max(0, distance / span));
  return nearHz + (farHz - nearHz) * t;
}
