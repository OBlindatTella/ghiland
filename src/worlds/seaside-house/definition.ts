import type { EnvironmentPreset } from '@/contracts/environment';
import type { Quat } from '@/contracts/math';
import type { WorldDefinition } from '@/contracts/world';
import { SEASIDE_FOG_COLOR, SEASIDE_FOG_DENSITY, SEASIDE_SUN, SEASIDE_SUN_AZIMUTH, SEASIDE_SUN_ELEVATION } from './art/horizon';
import { seasideAudio } from './audio';
import { seasideCollision, SPAWN } from './level';

/** Yaw around Y. Front face is local +Z (D-023). −165° faces the room and 15° toward x = 0. */
function yawQuat(deg: number): Quat {
  const half = (deg * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

const environment: EnvironmentPreset = {
  sun: {
    elevationDeg: SEASIDE_SUN_ELEVATION,
    azimuthDeg: SEASIDE_SUN_AZIMUTH,
    direction: [SEASIDE_SUN[0], SEASIDE_SUN[1], SEASIDE_SUN[2]],
    color: '#FFC98F',
    intensity: 2.6,
  },
  sky: { zenith: '#5E86AA', horizon: '#D6D4CC', sunGlow: '#FFE1B0' },
  fog: { color: SEASIDE_FOG_COLOR, density: SEASIDE_FOG_DENSITY },
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
  audio: seasideAudio,
  pinAnchors: [
    {
      id: 'hero-sea',
      position: [5.1, 1.45, 3.9],
      quaternion: yawQuat(-165),
      label: 'Sea',
    },
  ],
  portals: [
    {
      id: 'open-glass',
      between: ['interior', 'terrace'],
      bounds: { min: [-2, 0, 4.4], max: [2, 3.2, 4.6] },
      open: true,
    },
  ],
};
