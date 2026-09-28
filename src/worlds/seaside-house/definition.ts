import type { EnvironmentPreset } from '@/contracts/environment';
import type { WorldDefinition } from '@/contracts/world';
import { seasideCollision, SPAWN } from './level';

const environment: EnvironmentPreset = {
  sun: {
    elevationDeg: 12,
    azimuthDeg: 22,
    direction: [0.366, 0.208, 0.907],
    color: '#FFC98F',
    intensity: 2.6,
  },
  sky: { zenith: '#6E8EAE', horizon: '#E7C7A4', sunGlow: '#FFC98F' },
  fog: { color: '#E7C7A4', density: 0.011 },
  wind: {
    direction: [0, 0, -1],
    strength: 0.3,
    gust: null,
    frontSpeed: 6,
    seed: 1,
  },
};

export const seasideHouse: WorldDefinition = {
  id: 'seaside-house',
  version: 1,
  title: 'Seaside House',
  tagline: 'A corridor, then the glass.',
  status: 'playable',
  thumbnail: '/worlds/seaside-house/card.jpg',
  load: () => import('./module'),
  spawn: { position: [SPAWN.x, SPAWN.y, SPAWN.z], yaw: 0 },
  collision: seasideCollision,
  environment,
  zones: [
    {
      id: 'corridor',
      bounds: [{ min: [-1.1, 0, -9], max: [1.1, 2.4, -3.5] }],
      kind: 'interior',
      exposureTarget: 1.2,
    },
    {
      id: 'interior',
      bounds: [{ min: [-7, 0, -3.5], max: [7, 3.2, 4.5] }],
      kind: 'interior',
      exposureTarget: 1,
    },
    {
      id: 'terrace',
      bounds: [{ min: [-7, 0, 4.5], max: [7, 3, 9] }],
      kind: 'exterior',
      exposureTarget: 0.9,
    },
  ],
  portals: [
    {
      id: 'open-glass',
      between: ['interior', 'terrace'],
      bounds: { min: [-4, 0, 4.4], max: [0, 3.2, 4.6] },
      open: true,
    },
  ],
};
