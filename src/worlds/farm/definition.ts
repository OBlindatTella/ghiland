import type { EnvironmentPreset } from '@/contracts/environment';
import type { WorldDefinition } from '@/contracts/world';

const environment: EnvironmentPreset = {
  sun: {
    elevationDeg: 8,
    azimuthDeg: -30,
    direction: [-0.49, 0.14, 0.86],
    color: '#FFC98F',
    intensity: 1.4,
  },
  sky: { zenith: '#87A0C4', horizon: '#F0C48A', sunGlow: '#FFC98F' },
  fog: { color: '#F0C48A', density: 0.015 },
  wind: { direction: [0.2, 0, 1], strength: 0.35, gust: null, frontSpeed: 6, seed: 3 },
};

export const farm: WorldDefinition = {
  id: 'farm',
  version: 1,
  title: 'Golden Hour Farm',
  tagline: 'Soon',
  status: 'preview',
  thumbnail: '/worlds/farm/card.jpg',
  spawn: { position: [0, 1.62, 0], yaw: 0 },
  collision: { kind: 'boxes', walkable: { min: [0, 0, 0], max: [0, 0, 0] }, colliders: [], floorY: 0 },
  environment,
  zones: [],
};
