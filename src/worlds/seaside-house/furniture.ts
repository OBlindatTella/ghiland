import type { Collider, ColliderLayer } from '@/contracts/world';

export type FurnishMaterial = 'oak' | 'travertine' | 'linen' | 'teak' | 'plaster' | 'ceramic' | 'bronze' | 'plinth';

export interface Solid {
  id: string;
  min: [number, number, number];
  max: [number, number, number];
  material: FurnishMaterial;
}

const movement: ColliderLayer[] = ['movement'];
const pin: ColliderLayer[] = ['movement', 'pinSurface'];

function collider(id: string, min: [number, number, number], max: [number, number, number], layers: ColliderLayer[]): Collider {
  return { id, box: { min, max }, layers };
}

/**
 * Furniture stays outside the centre band x −2…+2 once the 0.3 m capsule is included.
 * Curtains, leaves, and the rug are not in this list.
 */
export const furnitureColliders: readonly Collider[] = [
  collider('sofa', [2.85, 0, -1.55], [5.5, 0.8, -0.4], movement),
  collider('coffee-table', [3.4, 0, -0.1], [4.9, 0.38, 0.55], pin),
  collider('floor-lamp', [2.42, 0, -1.72], [2.72, 1.55, -1.42], movement),
  collider('bookshelf', [5.55, 0, -3.45], [6.85, 2.15, -3.08], movement),
  collider('kitchen-island', [-6.2, 0, -1.2], [-3.7, 0.92, 0.35], pin),
  collider('stool-a', [-5.35, 0, 0.48], [-4.7, 0.64, 1.08], movement),
  collider('stool-b', [-4.55, 0, 0.48], [-3.9, 0.64, 1.08], movement),
  collider('dining-table', [-6.3, 0, 1.9], [-4.05, 0.76, 3.2], pin),
  collider('kitchen-shelf', [-6.85, 0, -3.45], [-5.55, 2.05, -3.08], movement),
  collider('study-desk', [5.4, 0, -2.7], [6.85, 0.76, -1.3], pin),
  collider('reading-chair', [-3.35, 0, 2.95], [-2.45, 0.9, 3.95], movement),
  collider('terrace-bench', [6.4, 0, 5.4], [6.92, 0.86, 8.1], movement),
  collider('terrace-chair-a', [3.55, 0, 6.15], [4.55, 0.72, 7.15], movement),
  collider('terrace-chair-b', [-5.2, 0, 6.25], [-4.25, 0.72, 7.2], movement),
  collider('fig-planter', [-3.3, 0, -3.0], [-2.5, 0.42, -2.2], movement),
];

export const furnitureVisuals: readonly Solid[] = [
  { id: 'sofa-plinth', min: [2.98, 0, -1.42], max: [5.38, 0.06, -0.5], material: 'plinth' },
  { id: 'sofa-base', min: [2.95, 0.14, -1.4], max: [5.4, 0.42, -0.48], material: 'linen' },
  { id: 'sofa-back', min: [2.95, 0.42, -1.5], max: [5.4, 0.78, -1.12], material: 'linen' },
  { id: 'sofa-arm-l', min: [2.88, 0.14, -1.45], max: [3.18, 0.62, -0.48], material: 'linen' },
  { id: 'sofa-arm-r', min: [5.18, 0.14, -1.45], max: [5.48, 0.62, -0.48], material: 'linen' },
  { id: 'coffee-top', min: [3.42, 0.3, -0.08], max: [4.88, 0.38, 0.52], material: 'travertine' },
  { id: 'coffee-leg', min: [3.55, 0, 0.05], max: [4.75, 0.3, 0.38], material: 'oak' },
  { id: 'lamp-pole', min: [2.52, 0, -1.64], max: [2.64, 1.35, -1.52], material: 'bronze' },
  { id: 'lamp-shade', min: [2.44, 1.32, -1.7], max: [2.7, 1.52, -1.44], material: 'linen' },
  { id: 'bookshelf', min: [5.58, 0, -3.42], max: [6.82, 2.1, -3.1], material: 'oak' },
  { id: 'island-top', min: [-6.15, 0.84, -1.15], max: [-3.75, 0.92, 0.3], material: 'travertine' },
  { id: 'island-base', min: [-5.95, 0, -0.95], max: [-3.95, 0.78, 0.12], material: 'oak' },
  { id: 'stool-a', min: [-5.3, 0.32, 0.52], max: [-4.75, 0.46, 1.02], material: 'oak' },
  { id: 'stool-b', min: [-4.5, 0.32, 0.52], max: [-3.95, 0.46, 1.02], material: 'oak' },
  { id: 'dining-top', min: [-6.26, 0.72, 1.95], max: [-4.1, 0.76, 3.15], material: 'oak' },
  { id: 'dining-base', min: [-5.7, 0, 2.25], max: [-4.8, 0.68, 2.85], material: 'oak' },
  { id: 'kitchen-shelf', min: [-6.82, 0.2, -3.42], max: [-5.58, 2.0, -3.12], material: 'oak' },
  { id: 'desk-top', min: [5.45, 0.68, -2.65], max: [6.82, 0.76, -1.35], material: 'oak' },
  { id: 'desk-leg', min: [5.6, 0, -2.4], max: [6.7, 0.68, -1.55], material: 'oak' },
  { id: 'chair-seat', min: [-3.28, 0.32, 3.05], max: [-2.52, 0.48, 3.55], material: 'linen' },
  { id: 'chair-back', min: [-3.32, 0.48, 3.42], max: [-2.48, 0.88, 3.9], material: 'linen' },
  { id: 'bench-plinth', min: [6.42, 0, 5.46], max: [6.9, 0.34, 8.04], material: 'plaster' },
  { id: 'bench-seat', min: [6.46, 0.34, 5.5], max: [6.86, 0.48, 8.0], material: 'teak' },
  { id: 'bench-back', min: [6.72, 0.48, 5.5], max: [6.9, 0.82, 8.0], material: 'teak' },
  { id: 'tch-a-seat', min: [3.65, 0.28, 6.25], max: [4.45, 0.42, 7.0], material: 'teak' },
  { id: 'tch-a-back', min: [3.65, 0.42, 6.85], max: [4.45, 0.7, 7.08], material: 'teak' },
  { id: 'tch-b-seat', min: [-5.1, 0.28, 6.35], max: [-4.35, 0.42, 7.05], material: 'teak' },
  { id: 'tch-b-back', min: [-5.1, 0.42, 6.9], max: [-4.35, 0.7, 7.15], material: 'teak' },
  { id: 'fig-pot', min: [-3.24, 0, -2.94], max: [-2.56, 0.4, -2.26], material: 'travertine' },
  { id: 'rug', min: [2.7, 0.006, -1.65], max: [5.65, 0.02, 0.15], material: 'linen' },
  { id: 'cup', min: [-4.72, 0.9, -0.28], max: [-4.5, 1.06, -0.08], material: 'ceramic' },
  { id: 'book', min: [4.55, 0.42, -1.05], max: [4.95, 0.48, -0.72], material: 'oak' },
  ...diningChairSolids(),
];

/** White chairs tucked 0.25 m under the slab. Backs match the movement-only boxes. */
function diningChairSolids(): Solid[] {
  const solids: Solid[] = [];
  for (const x of [-5.85, -5.18, -4.5]) {
    solids.push(
      { id: `dine-s-seat-${x}`, min: [x - 0.18, 0.42, 1.62], max: [x + 0.18, 0.5, 2.08], material: 'plaster' },
      { id: `dine-s-back-${x}`, min: [x - 0.18, 0.5, 1.62], max: [x + 0.18, 0.88, 1.74], material: 'plaster' },
      { id: `dine-n-seat-${x}`, min: [x - 0.18, 0.42, 3.02], max: [x + 0.18, 0.5, 3.46], material: 'plaster' },
      { id: `dine-n-back-${x}`, min: [x - 0.18, 0.5, 3.34], max: [x + 0.18, 0.88, 3.46], material: 'plaster' },
    );
  }
  return solids;
}

/** Fig footprint centre, used by the plant group. */
export const FIG_AT: [number, number, number] = [-2.9, 0, -2.6];
