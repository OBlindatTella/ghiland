import type { WorldAudioSpec } from '@/contracts/audio';

/**
 * Ocean and wind are field recordings. An empty src, or a file that fails to play,
 * falls back to the procedural beds in AudioEngine. See docs/AUDIO_CREDITS.md.
 */
export const seasideAudio: WorldAudioSpec = {
  beds: [
    { id: 'ocean', src: '/worlds/seaside-house/ocean.ogg', gain: 0.55, fadeInMs: 1400 },
    { id: 'wind', src: '/worlds/seaside-house/wind.ogg', gain: 0.22, fadeInMs: 1800 },
  ],
  emitters: [
    {
      id: 'gull',
      src: '/worlds/seaside-house/gull.ogg',
      position: [0, 14, 70],
      gain: 0.45,
      refDistance: 6,
      maxDistance: 140,
      rolloff: 'inverse',
    },
  ],
  occlusion: {
    exteriorSources: ['ocean', 'wind', 'gull'],
    lowpassNearHz: 3000,
    lowpassFarHz: 900,
    farDistance: 8,
    interiorBedGain: { wind: 0.25 },
  },
};
