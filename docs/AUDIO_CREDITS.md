# Audio credits

Alpha 0.1 step 4. Aura's preferred Freesound picks (`docs/phase-a/AURA_WORLDS.md` §8) need an account, so they are not used.

## Files in the repo

### `public/worlds/seaside-house/gull.ogg`

- Source: [Wikimedia Commons — XC707075 - European Herring Gull - Larus argentatus.mp3](https://commons.wikimedia.org/wiki/File:XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3)
- Direct file: https://upload.wikimedia.org/wikipedia/commons/5/5c/XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3
- Licence: CC0 (Creative Commons Zero). Commons `LicenseShortName` is CC0. The `©` in the embedded xeno-canto comment is that archive's template line; the Commons deed is CC0.
- Recordist: Sonothèque ADVL (Association de Défense de la Vallée du Lude / xeno-canto XC707075). Flight call, Carolles, Manche, Normandie, France, 2021-08-05.
- What shipped: the first 6 seconds, re-encoded to mono Vorbis OGG (~49 KB, ~66 kb/s). Original was a longer MP3.

## Procedural beds (no third-party recording)

Ocean and wind use empty `src` values. `AudioEngine` fills those with looping coloured-noise buffers (a slow swell, lowpassed for the sea, bandpassed for the wind) and the same crossfade path a file would use. A recorded bed can replace either layer by setting `src` to a compressed file; non-empty sources play through two `HTMLAudioElement`s with a random start offset and a 3 second handoff.

A Wikimedia file titled "Ocean Waves on a Tropical Beach" (Jarrod Stanley, labelled CC0) was downloaded and rejected. Its embedded metadata named a YouTube Topic upload ("Crain & Taylor") and a Russian title about a forest stream, so it is not in the repo.

## Buses

Master, ambient, and interface gains follow the settings sliders (perceived level is gain squared). Mute is a separate gain on `M` and does not suspend the context. Portal occlusion is a lowpass on the exterior beds, from distance to the open glass, plus a quieter indoor wind bed.
