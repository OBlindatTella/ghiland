import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

export interface SeasideMaps {
  travertine: CanvasTexture;
  oak: CanvasTexture;
  plaster: CanvasTexture;
  teak: CanvasTexture;
  rock: CanvasTexture;
  leaf: CanvasTexture;
}

const cache = new Map<number, SeasideMaps>();

function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function paint(size: number, draw: (pixels: Uint8ClampedArray, size: number, rand: () => number) => void, seed: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  const image = ctx.createImageData(size, size);
  draw(image.data, size, mulberry(seed));
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function set(pixels: Uint8ClampedArray, index: number, r: number, g: number, b: number) {
  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = 255;
}

function travertine(pixels: Uint8ClampedArray, size: number, rand: () => number) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const cell = Math.sin(u * 46.2) * Math.sin(v * 38.7);
      const pore = cell > 0.72 ? -32 * (cell - 0.72) : 0;
      const grain = Math.sin((u * 6 + v * 1.4) * Math.PI * 2) * 6 + (rand() - 0.5) * 8;
      const vein = Math.sin((u * 2.2 + v * 9) * Math.PI * 2) > 0.72 ? -12 : 0;
      set(pixels, (y * size + x) * 4, 214 + grain + pore + vein, 196 + grain * 0.8 + pore, 168 + grain * 0.6 + pore);
    }
  }
}

function oak(pixels: Uint8ClampedArray, size: number, rand: () => number) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const plank = Math.floor(v * 4);
      const seam = Math.abs(v * 4 - plank - 0) < 0.04 || (v * 4) % 1 < 0.035 ? -28 : 0;
      const grain = Math.sin((u * 18 + plank) * Math.PI * 2 + Math.sin(v * 40) * 2) * 8;
      const knot = Math.hypot(u - 0.3 - plank * 0.1, (v * 4) % 1 - 0.5) < 0.06 ? -18 : 0;
      const n = (rand() - 0.5) * 8;
      set(pixels, (y * size + x) * 4, 92 + grain + seam + knot + n, 68 + grain * 0.7 + seam + knot + n, 48 + grain * 0.4 + seam + n);
    }
  }
}

function plaster(pixels: Uint8ClampedArray, size: number, rand: () => number) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const blot = Math.sin(u * 9.5) * Math.cos(v * 7.2) * 7 + Math.sin((u + v) * 22) * 3;
      const n = (rand() - 0.5) * 8;
      set(pixels, (y * size + x) * 4, 237 + blot + n, 230 + blot * 0.85 + n, 218 + blot * 0.7 + n);
    }
  }
}

function teak(pixels: Uint8ClampedArray, size: number, rand: () => number) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const plank = Math.floor(u * 6);
      const seam = (u * 6) % 1 < 0.04 ? -22 : 0;
      const silver = Math.sin(v * 30 + plank) * 6;
      const n = (rand() - 0.5) * 10;
      set(pixels, (y * size + x) * 4, 138 + silver + seam + n, 114 + silver * 0.6 + seam + n, 86 + seam + n * 0.5);
    }
  }
}

function rock(pixels: Uint8ClampedArray, size: number, rand: () => number) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const n = Math.sin(u * 28) * Math.cos(v * 21) * 14 + (rand() - 0.5) * 18;
      const wet = v > 0.62 ? -16 : 0;
      set(pixels, (y * size + x) * 4, 92 + n + wet, 96 + n * 0.9 + wet, 94 + n * 0.85 + wet);
    }
  }
}

function leaf(pixels: Uint8ClampedArray, size: number) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const blade = (dx * dx) / 0.28 + (dy * dy) / 0.85;
      const index = (y * size + x) * 4;
      if (blade > 1) {
        pixels[index + 3] = 0;
        continue;
      }
      const vein = Math.abs(dx) < 0.035 ? 18 : 0;
      pixels[index] = 38 + vein;
      pixels[index + 1] = 92 - blade * 20;
      pixels[index + 2] = 48;
      pixels[index + 3] = 255;
    }
  }
}

const painters = [
  ['travertine', travertine, 3],
  ['oak', oak, 9],
  ['plaster', plaster, 11],
  ['teak', teak, 15],
  ['rock', rock, 21],
] as const;

export async function prepareSeasideTextures(report?: (fraction: number) => void, sizes: readonly number[] = [512, 1024]): Promise<void> {
  if (typeof document === 'undefined') {
    report?.(1);
    return;
  }
  const steps = sizes.length * (painters.length + 1);
  let done = 0;
  const tick = async () => {
    done += 1;
    report?.(done / steps);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  };
  for (const size of sizes) {
    if (cache.has(size)) {
      done += painters.length + 1;
      report?.(done / steps);
      continue;
    }
    const maps = {} as SeasideMaps;
    for (const [name, painter, seed] of painters) {
      maps[name] = paint(size, (pixels, resolution, rand) => painter(pixels, resolution, rand), seed);
      await tick();
    }
    maps.leaf = paint(Math.min(128, size), (pixels, resolution) => leaf(pixels, resolution), 1);
    cache.set(size, maps);
    await tick();
  }
  report?.(1);
}

export function seasideMaps(size: number): SeasideMaps | null {
  return cache.get(size) ?? null;
}

export function retainTextureSize(size: number): void {
  for (const [key, maps] of cache) {
    if (key === size) continue;
    for (const texture of Object.values(maps)) texture.dispose();
    cache.delete(key);
  }
}

export function dropSeasideTextures(): void {
  for (const maps of cache.values()) {
    for (const texture of Object.values(maps)) texture.dispose();
  }
  cache.clear();
}

/** GPU upload of the maps actually bound: seven tiled surfaces plus the leaf card, and a PMREM allowance. */
export function estimateTextureBytes(size: number): number {
  const leaf = 128 * 128 * 4;
  const pmrem = 4 * 1024 * 1024;
  return 7 * size * size * 4 + leaf + pmrem;
}

export function cloneRepeat(source: Texture, x: number, y: number): Texture {
  const map = source.clone();
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(x, y);
  map.needsUpdate = true;
  return map;
}
