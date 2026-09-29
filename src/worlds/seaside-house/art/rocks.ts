export interface RockPlacement {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
}

/** Cove rocks below and beyond the balustrade. None sit on the walkable terrace. */
export function rockLayout(): RockPlacement[] {
  const rocks: RockPlacement[] = [];
  let seed = 19;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 14; i += 1) {
    const span = 0.7 + rand() * 1.35;
    rocks.push({
      position: [-9 + rand() * 18, -5.35 + span * 0.25, 11.4 + rand() * 7.5],
      scale: [span * (0.85 + rand() * 0.4), span * (0.45 + rand() * 0.25), span * (0.8 + rand() * 0.45)],
      rotation: [rand() * 0.6, rand() * Math.PI * 2, rand() * 0.4],
    });
  }
  return rocks;
}

/** Foam hints: xz centre, radius, phase. Kept in the same cove as the rocks. */
export const FOAM_ROCKS: readonly [number, number, number, number][] = [
  [0.5, 13.5, 3.2, 0.4],
  [6.2, 15.2, 2.6, 1.7],
  [-5.4, 14.4, 2.8, 2.6],
  [2.4, 17.6, 2.2, 4.1],
];
