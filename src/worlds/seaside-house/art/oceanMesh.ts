import { BufferAttribute, BufferGeometry } from 'three';

/** Polar grid centred on the cove. Rings grow by 4.5% so the far edge is about 3.8 km. */
export function oceanGrid(tier: 'LOW' | 'MED' | 'HIGH' | 'ULTRA'): { rings: number; segments: number } {
  if (tier === 'LOW') return { rings: 70, segments: 120 };
  if (tier === 'MED') return { rings: 100, segments: 160 };
  return { rings: 140, segments: 256 };
}

export const OCEAN_RADIUS0 = 8;
export const OCEAN_RADIUS_GROWTH = 1.045;
export const OCEAN_ARC_DEG = 100;

export function oceanRadius(index: number): number {
  return OCEAN_RADIUS0 * OCEAN_RADIUS_GROWTH ** index;
}

export function buildOceanGeometry(rings: number, segments: number): BufferGeometry {
  const radial = rings + 1;
  const angular = segments + 1;
  const positions = new Float32Array(radial * angular * 3);
  const start = (-OCEAN_ARC_DEG * Math.PI) / 180;
  const span = ((OCEAN_ARC_DEG * 2) * Math.PI) / 180;
  let cursor = 0;
  for (let i = 0; i < radial; i += 1) {
    const radius = oceanRadius(i);
    for (let j = 0; j < angular; j += 1) {
      const theta = start + (j / segments) * span;
      positions[cursor] = Math.sin(theta) * radius;
      positions[cursor + 1] = 0;
      positions[cursor + 2] = Math.cos(theta) * radius;
      cursor += 3;
    }
  }
  const indices = new Uint32Array(rings * segments * 6);
  let triangle = 0;
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * angular + j;
      const b = a + 1;
      const c = a + angular;
      const d = c + 1;
      indices[triangle] = a;
      indices[triangle + 1] = c;
      indices[triangle + 2] = b;
      indices[triangle + 3] = b;
      indices[triangle + 4] = c;
      indices[triangle + 5] = d;
      triangle += 6;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** Y component of the first triangle's normal. Positive means the grid faces up. */
export function oceanUpNormalY(rings = 2, segments = 2): number {
  const geometry = buildOceanGeometry(rings, segments);
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!index) return 0;
  const read = (slot: number) => {
    const vertex = index.getX(slot);
    return [position.getX(vertex), position.getY(vertex), position.getZ(vertex)] as const;
  };
  const [ax, , az] = read(0);
  const [px, , pz] = read(1);
  const [qx, , qz] = read(2);
  const y = (pz - az) * (qx - ax) - (px - ax) * (qz - az);
  geometry.dispose();
  return y;
}
