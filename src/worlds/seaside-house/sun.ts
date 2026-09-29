/** D-027. Azimuth is degrees from +Z toward −X, so Seaside's 22° is azimuth −22°. */
export function sunDirection(elevationDeg: number, azimuthDeg: number): [number, number, number] {
  const elevation = (elevationDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const horizontal = Math.cos(elevation);
  return [Math.sin(azimuth) * horizontal, Math.sin(elevation), Math.cos(azimuth) * horizontal];
}
