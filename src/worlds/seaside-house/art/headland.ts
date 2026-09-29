import { BufferAttribute, BufferGeometry, Color } from 'three';

/** Spine from V2, θ left of +Z. y is the crest. The mesh continues 30 m under the sea. */
export const HEADLAND_SPINE: readonly [number, number, number][] = [
  [468, -2, 1156],
  [538, 23, 1125],
  [634, 22, 1189],
  [817, 46, 1255],
  [1061, 71, 1261],
  [1280, 66, 1190],
  [1515, 50, 1058],
  [1767, 29, 821],
];

const SEA_Y = -6;
const BASE_Y = SEA_Y - 30;
const SEAWARD_SLOPE = (60 * Math.PI) / 180;
const LANDWARD_SLOPE = (20 * Math.PI) / 180;

export interface FootPoint {
  x: number;
  y: number;
  z: number;
  theta: number;
  yaw: number;
}

function sampleSpine(t: number): [number, number, number] {
  const last = HEADLAND_SPINE.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * last;
  const index = Math.min(Math.floor(scaled), last - 1);
  const frac = scaled - index;
  const a = HEADLAND_SPINE[index]!;
  const b = HEADLAND_SPINE[index + 1]!;
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac, a[2] + (b[2] - a[2]) * frac];
}

function seaward(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z) || 1;
  return [-x / len, -z / len];
}

/** Waterline on the 60° seaward face, and a yaw that points the asset's +Z back toward the house. */
export function headlandFoot(t: number): FootPoint {
  const [x, y, z] = sampleSpine(t);
  const [sx, sz] = seaward(x, z);
  const drop = y - SEA_Y;
  const run = Math.max(drop, 0) / Math.tan(SEAWARD_SLOPE);
  const theta = Math.atan2(x, z);
  return {
    x: x + sx * run,
    y: SEA_Y,
    z: z + sz * run,
    theta,
    yaw: theta + Math.PI,
  };
}

function ridgeColor(y: number, crest: number): [number, number, number] {
  const top = crest - 0.4 * (crest - SEA_Y);
  let hex = '#9A8E7E';
  if (y >= top) hex = '#6F6F55';
  if (y <= -4.5 && y >= SEA_Y) hex = '#5F584F';
  if (y <= -5.6 && y >= -6.2) hex = '#E4E2DC';
  const color = new Color(hex);
  color.convertSRGBToLinear();
  return [color.r, color.g, color.b];
}

export function buildHeadlandGeometry(stations = 48, steps = 10): BufferGeometry {
  const around = steps * 2;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let s = 0; s < stations; s += 1) {
    const [x, crest, z] = sampleSpine(s / (stations - 1));
    const [sx, sz] = seaward(x, z);
    for (let k = 0; k <= around; k += 1) {
      const seawardSide = k > steps;
      const along = seawardSide ? (k - steps) / steps : 1 - k / steps;
      const slope = seawardSide ? SEAWARD_SLOPE : LANDWARD_SLOPE;
      const drop = (crest - BASE_Y) * along;
      const run = drop / Math.tan(slope);
      const sign = seawardSide ? 1 : -1;
      const py = crest - drop;
      positions.push(x + sx * run * sign, py, z + sz * run * sign);
      colors.push(...ridgeColor(py, crest));
    }
  }
  const stride = around + 1;
  for (let s = 0; s < stations - 1; s += 1) {
    for (let k = 0; k < around; k += 1) {
      const a = s * stride + k;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Pale layer behind the headland, θ 30°–70° at 2.8 km. */
export function buildFarRidgeGeometry(segments = 36, rows = 8): BufferGeometry {
  const radius = 2800;
  const top = SEA_Y + 150;
  const base = SEA_Y - 20;
  const positions: number[] = [];
  const start = (30 * Math.PI) / 180;
  const end = (70 * Math.PI) / 180;
  for (let s = 0; s <= segments; s += 1) {
    const theta = start + ((end - start) * s) / segments;
    const x = Math.sin(theta) * radius;
    const z = Math.cos(theta) * radius;
    const [sx, sz] = seaward(x, z);
    for (let row = 0; row <= rows; row += 1) {
      const y = base + ((top - base) * row) / rows;
      const inset = ((top - y) / Math.tan(SEAWARD_SLOPE)) * 0.15;
      positions.push(x + sx * inset, y, z + sz * inset);
    }
  }
  const indices: number[] = [];
  const stride = rows + 1;
  for (let s = 0; s < segments; s += 1) {
    for (let row = 0; row < rows; row += 1) {
      const a = s * stride + row;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const LIGHTHOUSE_AT: readonly [number, number, number] = [538, 23, 1125];

/** About 6k triangles on HIGH and ULTRA, about 2k on LOW. */
export function headlandResolution(tier: 'LOW' | 'MED' | 'HIGH' | 'ULTRA'): { stations: number; steps: number } {
  if (tier === 'LOW') return { stations: 40, steps: 12 };
  return { stations: 72, steps: 20 };
}

export interface HeadlandCliffPlacement {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

const CLIFF04_FACE_Z = 15.21;
const CLIFF04_SCALE = 2.5;

/** Three waterline copies between θ 25° and 40°. The face (local +Z) sits on the seaward foot. */
export function headlandCliffs(): HeadlandCliffPlacement[] {
  return [27, 32.5, 38].map((degrees, index) => {
    const foot = footAtTheta((degrees * Math.PI) / 180);
    const awayX = Math.sin(foot.theta);
    const awayZ = Math.cos(foot.theta);
    const push = CLIFF04_FACE_Z * CLIFF04_SCALE + (index - 1) * 8;
    return {
      position: [foot.x + awayX * push, -15.38, foot.z + awayZ * push],
      rotation: [0, foot.yaw, 0],
      scale: [CLIFF04_SCALE, CLIFF04_SCALE, CLIFF04_SCALE],
    };
  });
}

function footAtTheta(theta: number): FootPoint {
  let best = headlandFoot(0);
  let bestDelta = Infinity;
  for (let i = 0; i <= 80; i += 1) {
    const foot = headlandFoot(i / 80);
    const delta = Math.atan2(Math.sin(foot.theta - theta), Math.cos(foot.theta - theta));
    if (Math.abs(delta) < bestDelta) {
      best = foot;
      bestDelta = Math.abs(delta);
    }
  }
  return best;
}
