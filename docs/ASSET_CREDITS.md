# Asset credits

Seaside House art pass 2. Every file below is [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Downloads are from [Poly Haven](https://polyhaven.com). Geometry is meshopt-compressed and textures are KTX2 (ETC1S colour, UASTC normals and ARM). The Basis transcoder under `public/basis/` is the [BinomialLLC basis_universal](https://github.com/BinomialLLC/basis_universal) transcoder shipped with three.js.

| Asset id | Author | Licence | URL | Files |
|---|---|---|---|---|
| syferfontein_18d_clear_puresky | Greg Zaal (Original), Jarod Guest (Sky Edits) | CC0 | https://polyhaven.com/a/syferfontein_18d_clear_puresky | `public/assets/seaside/hdri/syferfontein_18d_clear_puresky_1k.hdr` |
| coastal_cliff_02 | Rob Tuytel (All) | CC0 | https://polyhaven.com/a/coastal_cliff_02 | `public/assets/seaside/models/coastal_cliff_02.glb`, `coastal_cliff_02-low.glb` |
| coastal_cliff_01 | Rob Tuytel (Photography, processing), Rico Cilliers (cleanup) | CC0 | https://polyhaven.com/a/coastal_cliff_01 | `public/assets/seaside/models/coastal_cliff_01.glb`, `coastal_cliff_01-low.glb` |
| coastal_cliff_04 | Rob Tuytel (Photography, processing), Rico Cilliers (cleanup) | CC0 | https://polyhaven.com/a/coastal_cliff_04 | `public/assets/seaside/models/coastal_cliff_04.glb`, `coastal_cliff_04-low.glb` |
| coast_rocks_05 | Rob Tuytel (All) | CC0 | https://polyhaven.com/a/coast_rocks_05 | `public/assets/seaside/models/coast_rocks_05.glb`, `coast_rocks_05-low.glb` |
| coast_land_rocks_03 | Rob Tuytel (Photography, processing), Rico Cilliers (cleanup) | CC0 | https://polyhaven.com/a/coast_land_rocks_03 | `public/assets/seaside/models/coast_land_rocks_03.glb`, `coast_land_rocks_03-low.glb` |

The two water normals (`public/assets/seaside/water/normal-a.ktx2`, `normal-b.ktx2`) are generated in `scripts/generate-water-normals.mjs` (sixteen random-phase sines). They are not a third-party asset.

The house surfaces (travertine, oak, plaster, teak, rock, fig leaf) are still painted at runtime in `art/textures.ts`. Audio credits stay in `docs/AUDIO_CREDITS.md`.
