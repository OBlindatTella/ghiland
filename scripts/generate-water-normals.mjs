import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const SIZE = 512;
const OUT = resolve('public/assets/seaside/water');
const TOKTX = process.env.TOKTX ?? '/tmp/KTX-Software-4.4.2-Linux-x86_64/bin/toktx';

function mulberry(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function waves(seed) {
  const rand = mulberry(seed);
  return Array.from({ length: 16 }, (_, index) => ({
    fx: 1 + Math.floor(rand() * 11),
    fy: 1 + Math.floor(rand() * 11),
    phase: rand() * Math.PI * 2,
    amp: 0.22 / (1 + index * 0.28),
  }));
}

function sample(set, u, v) {
  let height = 0;
  let du = 0;
  let dv = 0;
  for (const wave of set) {
    const angle = (wave.fx * u + wave.fy * v) * Math.PI * 2 + wave.phase;
    height += wave.amp * Math.sin(angle);
    const slope = wave.amp * Math.cos(angle) * Math.PI * 2;
    du += slope * wave.fx;
    dv += slope * wave.fy;
  }
  return { height, du, dv };
}

function encode(set) {
  const rgb = Buffer.alloc(SIZE * SIZE * 3);
  const slopeScale = 0.08;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const { du, dv } = sample(set, x / SIZE, y / SIZE);
      const dx = du * slopeScale;
      const dy = dv * slopeScale;
      const length = Math.hypot(dx, dy, 1);
      const nx = -dx / length;
      const ny = -dy / length;
      const nz = 1 / length;
      const offset = (y * SIZE + x) * 3;
      rgb[offset] = Math.round((nx * 0.5 + 0.5) * 255);
      rgb[offset + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      rgb[offset + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return rgb;
}

mkdirSync(OUT, { recursive: true });
for (const [name, seed] of [['normal-a', 11], ['normal-b', 29]]) {
  const png = resolve(OUT, `${name}.png`);
  const ktx = resolve(OUT, `${name}.ktx2`);
  await sharp(encode(waves(seed)), { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toFile(png);
  execFileSync(TOKTX, ['--encode', 'uastc', '--uastc_quality', '2', '--genmipmap', '--assign_oetf', 'linear', ktx, png], { stdio: 'inherit' });
}
