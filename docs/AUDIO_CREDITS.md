# Audio credits

Alpha 0.1. Aura's preferred Freesound picks (`docs/phase-a/AURA_WORLDS.md` §8) need an account, so they are not used.

## Files in the repo

### `public/worlds/seaside-house/ocean.ogg`

- Source: [BigSoundBank — Small Waves Facing the Ocean (1046)](https://bigsoundbank.com/small-waves-facing-the-ocean-s1046.html), direct file `https://bigsoundbank.com/UPLOAD/ogg/1046.ogg`
- Licence: CC0. The download page labels this recording CC0 (public domain). Attribution is not required; it is included anyway.
- Recordist: Joseph Sardin. Small waves in the English Channel, facing the sea, beach of Houlgate, Calvados, Normandy, France. Tascam DR-40, 48 kHz, stereo, 2 min 18 s.
- What shipped: the full take, re-encoded to stereo Opus in an Ogg container at about 96 kb/s (~1.5 MB, 85 kb/s average). No voices or music in the take. The engine overlaps the last 3 seconds with a new copy so the loop does not click.

### `public/worlds/seaside-house/wind.ogg`

- Source: [Wikimedia Commons — Wind - SoundCloud - Beeld en Geluid.ogg](https://commons.wikimedia.org/wiki/File:Wind_-_SoundCloud_-_Beeld_en_Geluid.ogg)
- Direct file: https://upload.wikimedia.org/wikipedia/commons/c/c6/Wind_-_SoundCloud_-_Beeld_en_Geluid.ogg
- Licence: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Commons `LicenseShortName` is CC BY-SA 3.0. The embedded copyright line points at the same deed.
- Recordist: Beeld en Geluid (Eigen Opnames / Geluid van Nederland). Title “Wind”, description “Waaien”. Field recording, dual-mono, 96 kHz.
- What shipped: the opening silence (0.8 s) was trimmed. A high-pass at 70 Hz, a gentle compressor, and a limiter tamed gusts that peaked at full scale. Short fades sit at both ends. Re-encoded to stereo Opus at about 96 kb/s (~2.0 MB, 77 kb/s average), 3 min 28 s. This derivative stays under CC BY-SA 3.0.

### `public/worlds/seaside-house/gull.ogg`

- Source: [Wikimedia Commons — XC707075 - European Herring Gull - Larus argentatus.mp3](https://commons.wikimedia.org/wiki/File:XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3)
- Direct file: https://upload.wikimedia.org/wikipedia/commons/5/5c/XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3
- Licence: CC0 (Creative Commons Zero). Commons `LicenseShortName` is CC0. The `©` in the embedded xeno-canto comment is that archive's template line; the Commons deed is CC0.
- Recordist: Sonothèque ADVL (Association de Défense de la Vallée du Lude / xeno-canto XC707075). Flight call, Carolles, Manche, Normandie, France, 2021-08-05.
- What shipped: the first 6 seconds, re-encoded to mono Vorbis OGG (~49 KB, ~66 kb/s). Original was a longer MP3.

## If a file does not play

`AudioEngine` starts a recorded bed through two `HTMLAudioElement`s, with a random start offset and a 3 second crossfade. If the element errors or `play()` rejects before the first copy starts, that bed falls back to the procedural coloured-noise loop (lowpassed for the sea, bandpassed for the wind). An empty `src` uses the procedural bed directly.

A Wikimedia file titled "Ocean Waves on a Tropical Beach" (Jarrod Stanley, labelled CC0) was downloaded in an earlier pass and rejected. Its embedded metadata named a YouTube Topic upload ("Crain & Taylor") and a Russian title about a forest stream, so it is not in the repo.

## Buses

Master, ambient, and interface gains follow the settings sliders (perceived level is gain squared). Mute is a separate gain on `M` and does not suspend the context. Portal occlusion is a lowpass on the exterior beds, from distance to the open glass, plus a quieter indoor wind bed. The same credits are listed in Settings, under About / credits.
