import type { EnvironmentPreset } from '@/contracts/environment';
import type { WorldDefinition } from '@/contracts/world';

const environment: EnvironmentPreset = {
  sun: {
    elevationDeg: -4,
    azimuthDeg: 20,
    direction: [0.34, -0.07, 0.94],
    color: '#FFB07A',
    intensity: 0.4,
  },
  sky: { zenith: '#1C2438', horizon: '#C47A4A', sunGlow: '#FFB07A' },
  fog: { color: '#C47A4A', density: 0.02 },
  wind: { direction: [1, 0, 0], strength: 0.2, gust: null, frontSpeed: 6, seed: 2 },
};

export const nyBalcony: WorldDefinition = {
  id: 'ny-balcony',
  version: 1,
  title: 'NY Balcony',
  tagline: 'Soon',
  status: 'preview',
  thumbnail: '/worlds/ny-balcony/card.jpg',
  spawn: { position: [0, 1.62, 0], yaw: 0 },
  collision: { kind: 'boxes', walkable: { min: [0, 0, 0], max: [0, 0, 0] }, colliders: [], floorY: 0 },
  environment,
  zones: [],
};
