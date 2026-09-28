import type { WorldAudioSpec } from '@/contracts/audio';

/**
 * Ocean and wind are procedural beds (empty src) so a recorded file can replace them later.
 * Gulls are a decoded one-shot from a CC0 file. See docs/AUDIO_CREDITS.md.
 */
export const seasideAudio: WorldAudioSpec = {
  beds: [
    { id: 'ocean', src: '', gain: 0.55, fadeInMs: 1400 },
    { id: 'wind', src: '', gain: 0.22, fadeInMs: 1800 },
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
