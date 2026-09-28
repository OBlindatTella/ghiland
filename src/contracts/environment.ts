import type { AABB, Vec3 } from '@/contracts/math';
import type { QualityTier } from '@/contracts/quality';

export interface GustEvent {
  startedAt: number;
  amplitude: number;
  riseS: number;
  holdS: number;
  fallS: number;
}

export interface EnvironmentState {
  sun: {
    elevationDeg: number;
    azimuthDeg: number;
    direction: Vec3;
    color: string;
    intensity: number;
  };
  sky: { zenith: string; horizon: string; sunGlow: string };
  fog: { color: string; density: number };
  wind: {
    direction: Vec3;
    strength: number;
    gust: GustEvent | null;
    frontSpeed: number;
    seed: number;
  };
  exposure: { zoneTarget: number };
  tier: QualityTier;
  audioZone: string;
}

export type EnvironmentPreset = Omit<EnvironmentState, 'tier' | 'audioZone' | 'exposure'>;

export interface WorldZone {
  id: string;
  bounds: AABB[];
  kind: 'interior' | 'exterior';
  exposureTarget: number;
  roomToneGain?: number;
}

export interface AcousticPortal {
  id: string;
  between: [zoneId: string, zoneId: string];
  bounds: AABB;
  open: boolean;
}
