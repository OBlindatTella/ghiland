/** Gerstner set. Swell runs from the open sea toward the cliff (−Z). Chop follows the breeze. */
export interface Wave {
  dirX: number;
  dirZ: number;
  length: number;
  amplitude: number;
  steepness: number;
  speed: number;
}

export const WAVES: readonly Wave[] = [
  { dirX: 0.04, dirZ: -1, length: 46, amplitude: 0.28, steepness: 0.28, speed: 0.85 },
  { dirX: -0.32, dirZ: -0.95, length: 24, amplitude: 0.14, steepness: 0.36, speed: 1.1 },
  { dirX: 0.48, dirZ: -0.88, length: 12, amplitude: 0.07, steepness: 0.42, speed: 1.35 },
  { dirX: -0.18, dirZ: -0.98, length: 7.5, amplitude: 0.04, steepness: 0.48, speed: 1.6 },
  { dirX: 0.62, dirZ: -0.78, length: 4.2, amplitude: 0.022, steepness: 0.4, speed: 1.85 },
];

export interface Displacement {
  x: number;
  y: number;
  z: number;
}

/** CPU twin of the ocean vertex shader. Phase uses the undisplaced xz. */
export function gerstnerDisplacement(x: number, z: number, time: number, count: number): Displacement {
  let px = x;
  let py = 0;
  let pz = z;
  const n = Math.max(0, Math.min(count, WAVES.length));
  for (let i = 0; i < n; i += 1) {
    const wave = WAVES[i];
    if (!wave) continue;
    const len = Math.hypot(wave.dirX, wave.dirZ) || 1;
    const dx = wave.dirX / len;
    const dz = wave.dirZ / len;
    const k = (Math.PI * 2) / wave.length;
    const phase = k * (dx * x + dz * z) + time * wave.speed;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    px += wave.steepness * wave.amplitude * dx * c;
    pz += wave.steepness * wave.amplitude * dz * c;
    py += wave.amplitude * s;
  }
  return { x: px, y: py, z: pz };
}
