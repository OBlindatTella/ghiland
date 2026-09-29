import { LinearSRGBColorSpace, RepeatWrapping, type Texture, type WebGLRenderer } from 'three';
import { prefixPublicUrl } from '@/deploy/basePath';
import { seasideKtx2 } from './ktx';

const URLS = [
  prefixPublicUrl('/assets/seaside/water/normal-a.ktx2'),
  prefixPublicUrl('/assets/seaside/water/normal-b.ktx2'),
] as const;
const buffers = new Map<string, ArrayBuffer>();

export interface WaterNormals {
  a: Texture;
  b: Texture;
  dispose: () => void;
}

async function cached(url: string): Promise<ArrayBuffer> {
  const existing = buffers.get(url);
  if (existing) return existing;
  const response = await fetch(url);
  if (!response.ok) throw new Error(url);
  const buffer = await response.arrayBuffer();
  buffers.set(url, buffer);
  return buffer;
}

function parse(gl: WebGLRenderer, buffer: ArrayBuffer): Promise<Texture> {
  const loader = seasideKtx2(gl);
  return new Promise((resolve, reject) => {
    loader.parse(buffer.slice(0), (texture) => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.colorSpace = LinearSRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    }, reject);
  });
}

/** Two tiled 512² normals. The ArrayBuffers stay cached so a context restore can re-upload them. */
export async function loadWaterNormals(gl: WebGLRenderer): Promise<WaterNormals> {
  const [aBuffer, bBuffer] = await Promise.all(URLS.map((url) => cached(url)));
  const [a, b] = await Promise.all([parse(gl, aBuffer!), parse(gl, bBuffer!)]);
  return {
    a,
    b,
    dispose: () => {
      a.dispose();
      b.dispose();
    },
  };
}
