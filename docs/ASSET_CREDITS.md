# Asset credits

Seaside House, art pass. Nothing in this pass was downloaded from a third-party library.

Geometry, materials, the sky, and the ocean are generated in the client. There is no GLB, no HDRI, and no KTX2 file. Poly Haven, ambientCG, Kenney, and Quaternius were the allowed CC0 sources. They were not used, because a fetched texture was not required and several of those sites sit behind a CDN or a login wall. Credit is recorded here anyway, including the choice not to ship their files.

## Procedural, made for this world

| What | Where | Licence |
|---|---|---|
| Analytic late-afternoon sky, sun disk, clouds, and the PMREM lighting built from that sky | `src/worlds/seaside-house/art/shaders.ts`, `art/environment.ts` | Original. No external HDRI. |
| Gerstner ocean (3–5 waves, fresnel, glitter, foam, horizon haze) | `art/shaders.ts`, `art/waves.ts` | Original shader. Not three.js `Water` / `Water2`. |
| Travertine, smoked oak, lime plaster, teak, rock, and the fig leaf card | `art/textures.ts` | Painted at runtime onto canvas. 512 px on LOW, 1024 px above. |
| House boxes, furniture, curtains, headland, cove rocks, lighthouse marker | `Scene.tsx`, `furniture.ts`, `level.ts` | Original geometry. No Draco or meshopt, because there is no mesh file. |
| Linen curtain billow | `art/curtains.ts` | Vertex shader. 0.35 m cap. Not a cloth sim and not a collider. |

## Audio

Unchanged from the earlier pass. See `docs/AUDIO_CREDITS.md`.

## Deliberately not shipped

- Poly Haven late-afternoon HDRI. The sky shader is the environment map, so the light matches the visible sky without a download.
- ambientCG material scans. The canvas tiles stand in for travertine, oak, plaster, teak, and rock.
- Kenney / Quaternius furniture and plant kits. The sofa, chairs, island, desk, bench, and fig are built from primitives.
- KTX2 / Basis and Draco / meshopt. There is no authored texture or mesh to compress. The deferral is in `docs/KNOWN_ISSUES.md`.
