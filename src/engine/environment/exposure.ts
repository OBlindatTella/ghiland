/** Simulated auto-exposure. No luminance readback (Aura). Corridor 1.2, facing the glass 0.9, damped over 1.5 s. */
export function exposureTarget(zoneId: string, facingGlass: number): number {
  const face = Math.min(1, Math.max(0, facingGlass));
  if (zoneId === 'corridor') return 1.2;
  if (zoneId === 'terrace') return 0.9;
  return 1 + (0.9 - 1) * face;
}

export function dampExposure(current: number, target: number, dt: number, tau = 1.5): number {
  const step = 1 - Math.exp(-Math.max(0, dt) / tau);
  return current + (target - current) * step;
}

export function zoneAt(position: { x: number; z: number }, zones: readonly { id: string; bounds: readonly { min: readonly number[]; max: readonly number[] }[] }[]): string {
  for (const zone of zones) {
    for (const box of zone.bounds) {
      const minX = box.min[0] ?? 0;
      const minZ = box.min[2] ?? 0;
      const maxX = box.max[0] ?? 0;
      const maxZ = box.max[2] ?? 0;
      if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ) return zone.id;
    }
  }
  return 'interior';
}
