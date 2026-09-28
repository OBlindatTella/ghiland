import type { Vec3 } from '@/contracts/math';

export interface AmbienceLayer {
  id: string;
  src: string;
  gain: number;
  fadeInMs?: number;
}

export interface SpatialEmitter {
  id: string;
  src: string;
  position: Vec3;
  gain: number;
  refDistance: number;
  maxDistance: number;
  rolloff: 'linear' | 'inverse' | 'exponential';
}

export interface PortalOcclusion {
  exteriorSources: string[];
  lowpassNearHz: number;
  lowpassFarHz: number;
  farDistance: number;
  interiorBedGain?: Record<string, number>;
}

export interface WorldAudioSpec {
  beds: AmbienceLayer[];
  emitters?: SpatialEmitter[];
  music?: { src: string; gain: number }[];
  occlusion?: PortalOcclusion;
}
