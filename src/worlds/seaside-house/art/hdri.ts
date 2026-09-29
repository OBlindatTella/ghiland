import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  PMREMGenerator,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { SEASIDE_SUN } from './horizon';

export const HDRI_URL = '/assets/seaside/hdri/syferfontein_18d_clear_puresky_1k.hdr';
const LUMINANCE_CAP = 12;

let cachedHdr: ArrayBuffer | null = null;

export interface SeasideEnvironment {
  texture: Texture;
  yaw: number;
  dispose: () => void;
}

function clampLuminance(data: Float32Array): { phi: number } {
  let peak = 0;
  let peakIndex = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    if (lum > peak) {
      peak = lum;
      peakIndex = i / 4;
    }
    if (lum > LUMINANCE_CAP) {
      const scale = LUMINANCE_CAP / lum;
      data[i] = data[i]! * scale;
      data[i + 1] = data[i + 1]! * scale;
      data[i + 2] = data[i + 2]! * scale;
    }
  }
  return { phi: peakIndex };
}

/** Rotate the clearest-sky HDR so its sun sits on the D-040 azimuth. */
export function environmentYaw(width: number, _height: number, peakIndex: number): number {
  const x = peakIndex % width;
  const u = (x + 0.5) / width;
  const phi = (u - 0.5) * Math.PI * 2;
  const target = Math.atan2(SEASIDE_SUN[2], SEASIDE_SUN[0]);
  return target - phi;
}

export async function environmentFromHdri(gl: WebGLRenderer): Promise<SeasideEnvironment> {
  if (!cachedHdr) {
    const response = await fetch(HDRI_URL);
    if (!response.ok) throw new Error('hdri');
    cachedHdr = await response.arrayBuffer();
  }
  const loader = new HDRLoader();
  loader.setDataType(FloatType);
  const parsed = loader.parse(cachedHdr.slice(0));
  const data = parsed.data as Float32Array;
  const peak = clampLuminance(data);
  const source = new DataTexture(data, parsed.width, parsed.height);
  source.type = FloatType;
  source.colorSpace = LinearSRGBColorSpace;
  source.mapping = EquirectangularReflectionMapping;
  source.flipY = true;
  source.minFilter = LinearFilter;
  source.magFilter = LinearFilter;
  source.needsUpdate = true;
  const pmrem = new PMREMGenerator(gl);
  const target = pmrem.fromEquirectangular(source);
  pmrem.dispose();
  source.dispose();
  const yaw = environmentYaw(parsed.width ?? 1, parsed.height ?? 1, peak.phi);
  return {
    texture: target.texture,
    yaw,
    dispose: () => {
      target.dispose();
    },
  };
}
