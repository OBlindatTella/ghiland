# AURA_ART_PASS_2 — Seaside House, art pass 2 (buildable brief)

Author: Aura (World, Atmosphere & Experience). For: the step-8 builder, via Ghiland Master.
Reviewed: PR #5 (`cursor/seaside-art-pass-7254`), screenshots 01–12 at HIGH 1920×1080, and the code in `Scene.tsx`, `furniture.ts`, `level.ts`, `art/shaders.ts`, `art/curtains.ts`.
Status: design brief. Canonical spec is still `AURA_WORLDS.md`. Where this file gives a number, it overrides the PR, not the spec.
Coordinates: three.js world, metres, Y up, +Z toward the sea, viewer-left is +X (D-019). Colours are sRGB hex; convert to linear in shaders.
Constraints kept: D-027 composition (sun az 22° toward −X, open panels x −2…+2, curtains at x ±1.8…±2.6 on z 4.3, soffit 2.10 m, fig at about (−2.9, 0, −2.6)); D-032 ray sets (nothing in this brief is added to any ray set except where a collider footprint is explicitly called out); budgets HIGH ≤150 draws / ≤750k tris / ≤384 MB, LOW ≤80 draws / ≤250k tris.

---

## 0. The one-paragraph diagnosis

The frame is monochrome. Sky horizon, fog, far sea, scene background, hemisphere light, sun and interior albedos are all the same sand-beige family (`#E7C7A4`, `#F4E0C4`, `#FFC98F`, `#E6D9C8`, `#C4A574`), so nothing reads as air, water or distance. There is no cool counter-colour anywhere. The fix is not "more assets" first; it is **a blue-grey sky and a real sea with distance, then ground under the house, then light**. Assets come after those three, because a Poly Haven sofa in a sepia fog still looks like a render.

Code causes confirmed in the PR:
- `fogExp2('#E7C7A4', 0.011)` fogs 70% at 100 m and 99% at 200 m. Everything past about 150 m is flat sand.
- The ocean shader adds its own haze, `1 − exp(−0.000121·d²)`, toward `uFog = #E7C7A4`. That is the same 0.011 density squared, so the sea is ≥90% sand from about 140 m out.
- The ocean plane is 380 × 270 m and ends at z ≈ 280. Beyond it you see `scene.background = #E7C7A4`, which is why the "far sea" is a flat sand band.
- The sky shader's horizon is `vec3(0.799, 0.571, 0.372)` linear ≈ sRGB `#E7C6A4`, orange, and the sun disk term `smoothstep(0.9986, 0.99955, sunDot) * 8.0` is about **3° in radius** (a real sun is 0.27°), which is the hot blob at the lintel.
- The ceiling hot spot is `pointLight [0.4, 2.35, 1.6]`, intensity 7, 0.85 m under a 3.2 m ceiling.
- The corridor is brown by **albedo**: floor `#8C7356`, walls `#6E5E4C`, ceiling `#5A4C3E` in `level.ts`. The spec said "same materials, darker by light".
- The living floor is travertine (`livingFloor #C4A574` with the travertine canvas). The spec floor is pale oak.
- The headland is `sphereGeometry` scaled [26, 8.5, 16] at (52, 1.2, 78): about 96 m away and 10° tall, widest at y 1.2 with a narrow waterline. That is a blimp by construction.
- Curtain backlight uses the view-space `normal` against a world-space sun vector, so the glow lands in the wrong place, and the planes have no pleats.
- The level-box curtain placeholders (`curtain-left/right`, 0.12 m thick, opacity 0.42) must not render on top of the art curtains; check they are hidden.

---

## 1. Problems ranked by how much they hurt the feeling

| Rank | Problem | Why it hurts |
|---|---|---|
| 1 | Sepia sky, sand fog, sand far sea, and the hard seam at the balustrade cap | The reveal is "the sea". Right now there is no sea past 150 m and no sky colour. The whole emotional payoff is missing. |
| 2 | Headland reads as a UFO/blimp | The only landmark on the horizon breaks believability in the hero frame. |
| 3 | No ground under the house | The house and terrace float. Shot 05's bench floats. No cliff, no cove, no waterline. |
| 4 | Lighting: ceiling hot spot, oversized sun disk, flat warm fill everywhere | No light direction, no light-to-shadow falloff into the room, no cool shadows. |
| 5 | Glass barely reads | Without frames and reflection, the "enormous glass wall" is just a hole. |
| 6 | Muddy brown corridor, spawn portal whites out | The first frame of the product is brown-on-white. |
| 7 | Paper curtains | The backlit right curtain is a key image in D-027. |
| 8 | Box furniture | Reads as greybox. |
| 9 | Flat walls and floor (no AO, skirting, real texture scale) | Surfaces read as CG planes. |

Build in this order. Stop after rank 4 and screenshot; ranks 1–4 alone should move the frame most of the way to the bar.

---

## 2. Fixes, rank by rank

### 2.1 Sky, fog, sea (rank 1)

**One shared GLSL function** `ghHorizon(dirXZ)` and `ghSky(dir)` is used by the sky dome, the ocean reflection and the ocean haze, so sea, fog and sky can never disagree. Delete the per-material copies.

**Sky ramp** (elevation above horizon; "away" is more than 60° of azimuth from the sun, "sun side" within 30°, blend between with `s = pow(max(dot(normalize(dir.xz), normalize(sun.xz)), 0.0), 6.0)`):

| Elevation | Away from sun | Sun side |
|---|---|---|
| 0° (horizon) | `#D6D4CC` | `#F1D7B0` |
| 2° | `#CBD0CF` | `#EDD3AE` |
| 8° | `#B3C2CB` | `#DCCFB8` |
| 20° | `#93AEC2` | `#B9BFC0` |
| 45° | `#7496B4` | `#8AA3B8` |
| 90° (zenith) | `#5E86AA` | `#5E86AA` |

- Sun glow: `+ #FFE1B0 · pow(sunDot, 8.0) · 0.55` and halo `+ #FFE9C8 · pow(sunDot, 180.0) · 1.2`.
- Sun disk: radius 0.27°, soft edge 0.04°: `smoothstep(0.999986, 0.999991, sunDot)` (cos 0.30° to cos 0.24°), value `#FFF6E6 × 24` (HDR, tone mapping and bloom handle it).
- Below the horizon (never seen past the sea, but the PMREM and reflections see it): `#2B3A40`, not brown.
- Clouds: two layers only. Layer A: thin cirrus streaks between 2° and 10°, coverage 0.22, lit `#F4EADF` on the sun side, `#D9D6D0` away. Layer B: sparse high patches 15–40°, coverage 0.12, `#EEE9E2`. No clouds within 6° of the sun.
- `scene.background = #D6D4CC` (only a fallback now; the dome covers it). Sky dome radius 4500, `renderOrder = -1`, `depthWrite = false`, `frustumCulled = false`. Camera `far = 5000`, `near = 0.08`.

**Fog (standard materials):** `FogExp2('#D6D4CC', 0.00048)`. That is 0.2% at 100 m, 21% at 1 km, 40% at 1.5 km, 84% at 2.8 km, 97.5% at 4 km. The interior and the cove are effectively fog-free; the headland softens; the sea's far edge vanishes into the horizon. Only the headland and far ridge sit meaningfully in fog, and they are on the away-from-sun side, so the constant away colour is correct for them.

**Fog in the sky and ocean shaders** uses the same exponent with the direction-dependent colour: `fogCol = mix(#D6D4CC, #F1D7B0, s)`.

**Ocean mesh:** replace the 380 × 270 plane with one polar grid centred on (0, −6, −3):
- Rings at `r_i = 8 · 1.045^i`, i = 0…140 (8 m to about 3800 m). Angular span −100°…+100° around +Z.
- HIGH/ULTRA: 140 rings × 256 segments ≈ 72k tris. MED: 100 × 160 ≈ 32k. LOW: 70 × 120 ≈ 17k.
- Gerstner amplitude multiplied by `smoothstep(900.0, 250.0, r)` so far waves flatten instead of aliasing.
- Near edge hidden under the cliff (§2.3). No second plane, no overlap, no seam.

**Water colour** (per fragment; `r` = horizontal distance from camera):
1. Body colour ramp: r ≤ 20 m `#1B4A52` → 60 m `#1F4A5A` → 200 m `#24485E` → ≥600 m `#26455C`. Backlit crest scatter: `+ #2F7C79 · max(h, 0) · 1.2 · pow(max(dot(-V, sunDirXZ), 0), 2)`.
2. Reflection: Schlick with F0 = 0.02, `F = 0.02 + 0.98·pow(1 − dot(N, V), 5)`, clamp 0.9. Reflect `ghSky(R)` (clouds on, same function as the dome).
3. Detail normals: two scrolling normal maps (512², tileable, generated offline from 16 random-phase sines so there is no licence question), world scales 7 m and 23 m, speeds 0.035 and 0.02 m/s along the onshore wind. Their strength fades `mix(1.0, 0.15, smoothstep(50.0, 1500.0, r))`, so distant water reflects the near-horizon sky and converges on the horizon colour by itself.
4. Glitter: sun specular from the detail normals, `pow(max(dot(N, H), 0), 900.0) · 30.0 · #FFE6B8`. Delete the `floor(vWorld.xz * 3.5)` hash sparkle; it makes square blocks.
5. Haze: `1 − exp(−(0.00048·d)²)` toward `fogCol(dir)`. Delete `0.000121·d²`.
6. Foam near rocks: `#D9DDD8` at up to 0.55; the shore band `smoothstep(20, 11.2, z)` goes, replaced by per-rock foam rings (§2.3).

**Expected on-screen values** at V2, exposure 0.9 (the reviewer should colour-pick these; ±8 in each channel is fine):

| Where | Away from sun (about 35° left) | Toward sun (22° right) |
|---|---|---|
| Near water, 10–30 m, seen from the terrace | `#1E4D56` | `#2A5A5E` with sparkles |
| 50 m | `#2A5563` | `#3E5A60` |
| 200 m | `#4A6878` | `#6E6A62` + glitter `#FFE6B8` |
| 800 m | `#8497A2` | `#B8A88E` |
| 2 km | `#B6BFC1` | `#D9C9AE` |
| Horizon | `#D6D4CC` | `#F1D7B0` |

**The seam at the balustrade cap.** It sits exactly at y ≈ 1.05 in shots 02, 03 and 06 from different eye points, so it is tied to the balustrade, not to a distance. From V2 the cap is 2.6° below the horizon, where the current haze is already 96% sand; the teal below the cap therefore cannot come from the ocean shader as written. I can't explain it from the code I read, so the builder must isolate it before rebuilding:
1. Hide `rail-north`, `rail-west`, `rail-east` and `rail-cap-north`. If the seam goes, the rail material or its render order is the cause.
2. Check whether the rail uses a transmission (`MeshPhysicalMaterial.transmission`) or any second render of the ocean; transmission renders the opaque scene again, and any difference there shows exactly at the glass edge.
3. Final setup: rail glass `renderOrder = 2`, `depthWrite = false`, `transparent = true`, no transmission, `fog = false` (it is 3–12 m away).
Whatever the cause, the continuous ramp above removes the colour jump on the shader side.

### 2.2 Headland (rank 2)

Move it out to 1.25–2 km, make it a ridge rather than a blob, and sink it into the water.

**Silhouette from V2 (0, 1.62, −3)** (θ = degrees left of +Z, toward +X; heights above the sea at y −6):

| Point | θ | Distance | World (x, y_top, z) | Height above sea | Angle above eye | Pixels at 1080p, 62° vFOV |
|---|---|---|---|---|---|---|
| Tip islet | 22° | 1250 m | (468, −2, 1156) | 4 m | −0.17° (just above the far waterline) | 3 |
| Tip cliff with lighthouse | 25.5° | 1250 m | (538, 23, 1125) | 29 m | 1.0° | 17 |
| Saddle | 28° | 1350 m | (634, 22, 1189) | 28 m | 0.85° | 15 |
| Shoulder | 33° | 1500 m | (817, 46, 1255) | 52 m | 1.7° | 30 |
| Summit | 40° | 1650 m | (1061, 71, 1261) | 77 m | 2.4° | 42 |
| Ridge | 47° | 1750 m | (1280, 66, 1190) | 72 m | 2.1° | 37 |
| Ridge (study window view) | 55° | 1850 m | (1515, 50, 1058) | 56 m | 1.5° | 26 |
| Tail, into haze | 65° | 1950 m | (1767, 29, 821) | 35 m | 0.8° | 14 |

**Construction:**
- Main body: one procedural ridge mesh through the points above (spine polyline with a cross-section of a 55–65° seaward face on the −X/−Z side and a 20° landward back), extended **30 m below y −6** with no undercut, so the base widens into the water. About 6k tris on HIGH, 2k on LOW. Vertex colours: top 40% maquis `#6F6F55`, faces `#9A8E7E`, wet band from y −6 to −4.5 `#5F584F`, foam line y −6.2 to −5.6 `#E4E2DC`.
- Waterline detail: three instances of **coastal_cliff_04** (decimated to 8k tris, scaled ×2.5 → about 217 m long, 27 m high), sunk 40% below y −6 along the seaward foot between θ 25° and 40°. They give the base a real rock silhouette where the eye checks for grounding.
- Lighthouse on the tip cliff at (538, 23, 1125): white tower `#EDE8DF`, 16 m tall, 4 m wide, dark lantern room `#2E2A26` on top, beacon off in daytime (it sweeps only at sunset, per spec). About 3 px wide and 15 px tall from V2; that is correct and legible.
- Far ridge: a second procedural strip at 2.8 km, θ 30°–70°, 150 m high (about 3.1°), 1k tris, colour `#8E8F8A`. At 84% fog it reads as one pale layer behind the headland, which gives depth.
- `castShadow = false`, `receiveShadow = false`, fog on. None of it is in any ray set.
- Delete both ellipsoids at (52, 1.2, 78) and (74, 2.4, 98) and the lighthouse at (46, 8.2, 70).
- Depth precision: with near 0.08 the depth step at 1.5 km is about 1.7 m, so the waterline intersection can crawl. The vertex-colour foam and wet band hide it; if it still flickers, raise `near` to 0.1.

### 2.3 Cliff and cove under the house (rank 3)

The house is "cantilevered over a rocky cove". Build that.

| Piece | Asset | Decimated tris (HIGH / LOW) | Transform | Notes |
|---|---|---|---|---|
| Cliff under the house | coastal_cliff_02 | 20k / 5k | Scale (1.25, 1, 1) → about 51 m wide. Yaw so the face points +Z. Base at y −10.3, so the top is at about −0.25, hidden under the floor. Seaward face at z ≈ 7 at the waterline, z ≈ 5 at the top. | The terrace cantilevers from z 4.5 to 9 over the face. Put a 0.35 m terrace slab edge in plaster `#BFB3A3` with a dark shadow gap under it. |
| Left cove arm (+X) | coastal_cliff_01 | 16k / 4k | Scale (0.55, 0.9, 0.9) → about 50 m long, 9.3 m tall. Runs from (12, _, 3) to (34, _, 45) (yaw about 27.6° toward +X). Base y −10.3, top y −1.0 near the house, falling to about −4.5 at the far end. Face toward the cove (−X). | From V2 its top stays ≥5° below the horizon, so it frames the lower left without touching the headland or the Notes pane. |
| Right cove arm (−X) | coastal_cliff_01 (same geometry, separate mesh because the mirror flips winding) | 16k / 4k | Mirror scale (−0.45, 0.8, 0.8). Runs from (−16, _, 4) to (−30, _, 20). Top y −1.5, falling to −5. | Must stay right of the glitter lane: at every point x < −0.7·(z + 3). |
| Waterline boulders | coast_rocks_05 | 2k each, instanced (1 draw) / hidden on LOW except two | Six instances: (7, −6.2, 9), (−6.5, −6.2, 8.5), (12.5, −6.4, 12), (−15, −6.4, 10), (18, −6.5, 22), (−22, −6.5, 16). Random yaw, scale 0.8–1.6. | Move `FOAM_ROCKS` to these positions so the foam rings match the rocks and the rock audio sources. |
| Wet rock shelf at the cliff foot | coast_land_rocks_03 | 6k each, instanced / not on LOW | Two instances: (−3, −6.9, 7.5) and (8, −6.9, 9.5), yaw 15° and −40°. | Half-submerged flat slabs; waves wash over them. |

- Rock material (all pieces): the asset's own 1k maps, tinted toward warm limestone: dry `#B7AA98`, wet `#5E564C`. Wet band: below `y = −5.4 + waveHeight(x, z)` multiply albedo by 0.55 and set roughness 0.25.
- Delete the rock plane at (0, −3.6, 11.4) and the instanced icosahedron rocks.
- None of this casts shadows (the sun shadow camera stays fitted to the house) and none of it is in any ray set.
- Decimation (offline, once): `gltf-transform weld`, then `simplify --ratio R --error 0.05`, with R = 0.0113 (cliff_02), 0.0185 (cliff_01), 0.0028 (cliff_04), 0.0014 (coast_rocks_05), 0.0029 (coast_land_rocks_03). Keep the original normal map. Check each silhouette in a screenshot before committing. Add a 25% LOD for LOW.

### 2.4 Lighting recipe (rank 4)

- **Delete** `pointLight [0.4, 2.35, 1.6]`. Rule from now on: no point light closer than 1.2 m to any surface.
- **Delete** `hemisphereLight('#F4E0C4', '#6A5344', 0.16)`. It is the main source of the sepia fill.
- **Sun:** DirectionalLight `#FFC98F` (D-027), intensity **3.2**, direction (−0.367, 0.208, 0.907). Shadows: PCFSoft, map 2048 on HIGH, 4096 on ULTRA, 1024 on LOW/MED, ortho camera fitted to x −8…8, z −4…10, y −1…4 in light space, `bias −0.0002`, `normalBias 0.03`. The roof/ceiling slab and the header must cast shadows (`shadowSide = DoubleSide`) so the sun never leaks into the back of the room.
- **IBL:** Poly Haven HDRI **`syferfontein_18d_clear_puresky`**, 1k .hdr (1.1 MB) on every tier, 2k (4.2 MB) on ULTRA only. It is a clear sky with the sun at 18°, so it gives the cool blue fill the frame is missing. Backup: `qwantani_late_afternoon_puresky`.
  - Before PMREM, clamp texel luminance to 12, so its sun doesn't add a second hard highlight.
  - Rotate it so its brightest texel sits at azimuth 22° toward −X (`scene.environmentRotation.y`, three r162+; otherwise rotate at PMREM time).
  - `scene.environmentIntensity = 0.6`. Dispose the source texture after PMREM; the D-039 context-restore rebuild reloads from the cached ArrayBuffer.
  - The visible sky stays the analytic dome from §2.1 (a 2k equirect would be about 4× too soft at 1080p).
- **Room occlusion (replaces the missing lightmap bake for this pass):** IBL knows nothing about walls, so today the back of the room and the corridor get full sky light, which is why everything is flat. Every interior material (architecture, furniture, plants, props) multiplies indirect diffuse and indirect specular by `k`:
  - corridor, z < −3.5: `k = mix(0.22, 0.45, smoothstep(-9.0, -3.5, z))`
  - room: `k = mix(0.50, 1.00, smoothstep(-3.5, 4.5, z))`
  - terrace and exterior: `k = 1`
  One shared `onBeforeCompile` chunk on `reflectedLight.indirectDiffuse` and `indirectSpecular`. The real bake from the spec (AO plus indirect, two 2048 atlases) replaces this in a later pass.
- **Bounce from the sunlit floor (MED and up):** one RectAreaLight 6 × 3 m at (0, 0.05, 2.6) facing +Y, `#F2CFAA`, intensity 1.6, no shadows. This gives the correct version of the "ceiling glow": a soft warm gradient on the ceiling from about `#D8CCBC` near the glass to `#A99B8B` at the back wall. LOW: vertex colours on an 8 × 4 subdivided ceiling with the same gradient.
- **Practicals:** the floor lamp at (2.57, 0, −1.57) has an emissive shade `#FFE3C2` at 0.6 plus a point light at the shade centre (2.57, 1.38, −1.57), `#FFD9B0`, intensity 1.5, distance 3, decay 2, no shadow. That is the one warm light source for the look-back shot. Pendants and the lantern stay off by day.
- **Exposure:** keep D-027, 1.2 in the corridor settling to 0.9 facing the glass. Target values at V2: floor in sun `#E8C9A0`, floor in shade `#9C8670`, back wall `#B8AC9C`, ceiling near glass `#D8CCBC`. If the spawn portal clips (anything in it above 0.85 display value), lower the corridor exposure to 1.1.
- **AO and contact shadows:**
  - HIGH: N8AO (or three's GTAO if it fits the post stack better) at half resolution, radius 0.5 m, distance falloff 0.5, intensity 2.5, colour `#1E1712`. ULTRA: full resolution.
  - Every tier: blob contact-shadow decals under every furniture piece and plant. One shared 128 px radial-gradient texture, `MeshBasicMaterial('#1A140F')`, opacity 0.28–0.45, footprint plus 0.15 m on each side, y = 0.003, `polygonOffset −1`, `depthWrite false`. One InstancedMesh, so one draw.
  - Every tier: the Poly Haven assets' own AO (R channel of the ARM map) as `aoMap`.
  - LOW/MED: a 0.25 m-wide dark gradient strip along the floor–wall edges (instanced quads, opacity 0.25).
- **Grade:** keep AgX. Add saturation 1.12 and contrast 1.05, and a gentle split tone (shadows toward `#1E2226`, highlights toward `#FFF1DE`). AgX desaturates, which is part of the current monochrome look. Bloom: threshold 1.0, intensity 0.25; only the sun disk and glitter should bloom.
- **Sun disk at the lintel:** with the 0.27° disk from §2.1, the sun (12.0°) still shows a 0.17° sliver under the 11.9° lintel at V2. That is acceptable. If the Master wants it fully hidden, the fix is sun elevation 12.5°, vector (−0.366, 0.216, 0.905); that is a D-027 amendment and the Master's call, not a builder change.

### 2.5 Glass (rank 5)

The glass reads through its **frames and reflections**, not through its tint.
- Frames, dark bronze `#3B2F25` (the PR's `#6e5a45` is too light and brown), roughness 0.45, metalness 0.6:
  - Mullions 50 mm wide × 120 mm deep at x = ±2 and ±4. Jambs 80 mm at x = ±6.
  - Head 80 mm at y 3.12–3.20. A flush floor track 40 mm wide at z 4.44–4.56.
  - The open centre panels are drawn slid behind the x ±2…±4 panels on an inner track at z 4.40, so the opening edges show a double mullion. Visual only; colliders unchanged.
- Glass shader (closed panels and balustrade): transparent, `depthWrite = false`, alpha `mix(0.04, 0.35, pow(1.0 − abs(dot(N, V)), 4.0))`, colour = env reflection (PMREM, roughness 0.05) plus tint `#9FB3B0` at 0.3. Add a 512 px greyscale smudge texture (generated offline) that raises alpha by up to 0.03 and roughness to 0.4 locally, heavier near hand height (y 0.9–1.4) by the open panels.
- Walking along the glass you should see the sky slide across it; face-on it is almost invisible. Both are correct.
- Balustrade: 12 mm frameless glass, same shader, with a slim bronze cap channel 30 mm wide × 25 mm high at y 1.05–1.075, replacing the 60 mm off-white cap `#F2EFE8` (it reads as a thick grey band in shots 02 and 06).
- Render order: rail glass 2, closed panels 3, UI windows after.

### 2.6 Corridor and the spawn frame (rank 6)

- Walls: plaster `#E6DDCF` (same material as the room, one step warmer). Floor: the same oak as the room, continuous under the soffit. Ceiling at 2.4 m: pale oak slats `#C9A67E`, 40 mm slats with 20 mm dark gaps `#2A211A` running along Z (the lines lead to the reveal). Do it in the shader as stripes on one plane, not as real slats.
- Soffit stays smoked oak `#4A3B2E` (D-027). It is the dark frame.
- Darkness comes from light, not paint: room occlusion `k` 0.22–0.45 (§2.4), plus one recessed downlight at (0, 2.39, −7.4): SpotLight `#FFD6A8`, angle 50°, penumbra 0.8, intensity 4, distance 5, no shadow, aimed at (0, 0, −7.4), with a small emissive disk in the ceiling. LOW: skip the spot and paint the pool into the floor's vertex colour.
- Target values at spawn: side walls `#6F665B` → `#857A6D` toward the mouth (neutral warm grey, not red-brown), floor pool `#A48A6C`.

### 2.7 Curtains (rank 7)

- Geometry: 0.8 × 3.05 m plane, 48 × 40 segments (about 3.8k tris each), top at y 3.07 and hem at y 0.02. Base pleats: `z += 0.035 · sin(2π · x / 0.11)` (70 mm fold depth, about 7 folds). This is a 1.6 m fabric gathered to 0.8 m. The existing billow (≤0.35 m) and flutter go on top, unchanged.
- Hung from a recessed ceiling pocket, a 90 mm wide × 60 mm deep slot at z 4.25–4.34 running x −6…6, dark inside (`#2A231D`). Positions exactly D-027: left x +1.8…+2.6, right x −2.6…−1.8.
- Material: colour `#F1EBE0`; Poly Haven `rough_linen` normal (`normalScale 0.5`) and roughness at its real size, 0.27 m per tile; its diffuse is blue, so use it only as a greyscale multiplier (0.85–1.0). Roughness 0.9, DoubleSide, back faces with flipped normals.
- Alpha: `mix(0.62, 0.92, pow(1.0 − abs(dot(N, V)), 2.0))`, so the folds read denser than the flat fabric. The bottom 80 mm is a doubled hem band at +0.12 alpha.
- Light: wrap diffuse `(dot(N, L) + 0.5) / 1.5`, and transmitted sun `pow(max(dot(-V, L), 0.0), 4.0) · 0.9 · sunColour · (1.0 − 0.5·alpha)` computed with **world-space** V and L (the current code mixes view and world space).
- Result at V2: the right curtain (toward the sun) glows `#F4DFC0` with bright fold edges; the left curtain reads cool off-white `#E3E1DC` with visible fold shading.
- No shadow casting, no ray sets (D-032). Hide the `level.ts` placeholder curtain boxes.

### 2.8 Furniture (rank 8)

Poly Haven's furniture is mostly antique or rustic and clashes with the warm-minimal house, so I've taken only the pieces that fit and building the rest procedurally, with bevelled or rounded geometry (`RoundedBoxGeometry`, 3 segments, 20–40 mm radius) and real textures. **Collider footprints from `furnitureColliders` stay as they are** (except the two flagged items), so collision work doesn't regress.

| Item (collider id) | Source | Look | Placement |
|---|---|---|---|
| Sofa (`sofa`) | Procedural | Low linen sofa: recessed dark plinth 60 mm high `#3A2F25` (it floats), seat height 0.40, back 0.72, arms 0.18 wide × 0.55 high. Two seat cushions 1.1 × 0.8 × 0.16, three loose back cushions rotated 2–4° and sunk 10 mm. Fabric `#E3D8C8` with the rough_linen normal at 0.27 m; on HIGH/ULTRA MeshPhysical sheen 0.5, sheenColor `#FFF3E3`, sheenRoughness 0.8. | Inside [2.85, 0, −1.55]–[5.5, 0.8, −0.4], facing +Z. Throw (curly_teddy_natural texture) over the left (+X) arm; one book face-down on the right arm. |
| Coffee table (`coffee-table`, pin) | Procedural (Poly Haven coffee_table_round_01 / modern_coffee_table_01 are fine alternates only if the top is re-seated at 0.38) | Monolithic travertine block, 1.45 × 0.62, top at **0.38 exactly** (pin surface), 8 mm bevel. | Centre (4.15, 0, 0.225). |
| Rug | Procedural + ambientCG `Carpet016` | 2.4 × 1.7 m, 12 mm thick with a bevelled edge, `#D9CDBB`. | Centre (4.15, 0.006, −0.3). Not a collider. |
| Floor lamp (`floor-lamp`) | Procedural | Bronze stem 12 mm, linen drum shade Ø0.38 × 0.28 at y 1.25–1.53, travertine base disk Ø0.28. | (2.57, 0, −1.57). |
| Bookshelf, kitchen shelf | Procedural oak + **decorative_book_set_01** (decimate to 15k) + **ceramic_vase_02/03/04** | Open oak shelving, 5 shelves, 30 mm boards. Books split across shelves, a few leaning, one stack slightly crooked. | Inside their colliders. |
| Kitchen island (`kitchen-island`, pin) | Procedural | Travertine box with a 30 mm overhanging top slab and a recessed 80 mm oak toe kick. Top at 0.92. | Inside [−6.2, 0, −1.2]–[−3.7, 0.92, 0.35]. **wooden_bowl_01** (decimate to 3k) with five **lemon** instances (decimate to 1k each) at (−4.6, 0.92, −0.35). |
| Stools a/b | Procedural | Oak counter stools, seat Ø0.36 at 0.64, four splayed legs. | Collider centres. |
| Dining table (`dining-table`, pin) | Procedural | Oak slab 2.2 × 0.95 × 0.04 on two slab legs, top 0.76. | Fix S5-01: collider minX **−6.3** (from −6.45). |
| Dining chairs ×6 | **painted_wooden_chair_01** (724 tris), instanced | White spindle chairs; keep, they read Mediterranean. | Three per long side at x −5.85, −5.18, −4.5; z 1.75 (facing +Z) and z 3.35 (facing −Z), tucked 0.25 m under. The backs stick out about 0.29 m past the table box. Either accept walk-through or add two **movement-only** boxes (not pin surfaces). Atlas/Sentinel's call. |
| Pendants ×2 | **modern_ceiling_lamp_01** | White glass globes, off by day. | (−5.7, _, 2.55) and (−4.6, _, 2.55), globe bottom at y 1.55, thin cord to the ceiling. |
| Study desk (`study-desk`, pin) | Procedural oak | 1.4 × 0.7 top at 0.76. Optional **modern_arm_chair_01** tucked in. **round_spectacles** (decimate to 2k) on the desk. | Inside its collider. |
| Reading chair (`reading-chair`) | **mid_century_lounge_chair** | Brown leather lounge chair, scaled 0.88. Yaw so it faces +Z turned 30° toward the room. Knitted jumper (knitted_fleece texture on a draped mesh) over the back. | (−2.9, 0, 3.43). The mesh is larger than today's collider, so grow the collider to the mesh bounds, about [−3.35, 0, 2.95]–[−2.45, 0.9, 3.95]. That keeps maxX + 0.3 = −2.15, outside the walk band (D-020). Flag to Sentinel. |
| Fig planter (`fig-planter`) | **potted_plant_01** (decimate to 25k), scaled 1.4 → about 1.9 m | Small tree in terracotta. Leaves are visual only (D-032). | (−2.9, 0, −2.6). |
| Indoor plant | **potted_plant_02** (decimate to 20k) | | Beside the bookshelf at about (5.2, 0, −3.1). |
| Terrace bench (`terrace-bench`) | Procedural | Built-in teak bench on a plaster plinth that meets the deck (no floating legs). Cream cushion `#E9DFCF`, towel over one end. | Inside [6.4, 0, 5.4]–[6.92, 0.86, 8.1]. |
| Terrace chairs a/b | Procedural | Low teak lounge chairs, 0.75 wide × 0.95 deep, seat 0.35, back reclined 105°, cream cushions `#E9DFCF`. (Poly Haven's outdoor set is a folding bistro set and doesn't fill these footprints.) | Collider centres, facing +Z, turned 10° toward each other. |
| Terrace tree and grasses | **potted_plant_01** (same geometry, scaled 1.6) in **planter_box_02**; grasses as instanced cards | Stands in for the olive until a light enough olive exists (island_tree_02 is 1.76M tris). | Planter at (−6.3, 0, 8.3), tree at (−6.2, 0, 5.3). Not colliders. |
| Terrace lantern | **wooden_lantern_01** | Candle off by day. | (6.3, 0, 8.4). |
| Micro props | **planter_pot_clay**, a cup (procedural), a little sand and dried leaves (decal) | Per spec's MICRO list. | Hidden on LOW. |

Rejected Poly Haven pieces (style clash): sofa_03 (tufted Victorian), dining_table (checkered tablecloth), dining_chair_02 (tufted leather), gallinera_chair, Sofa_01, ArmChair_01, throw_pillows_01 (loud chevron), wool_boucle texture (plaid). Two ids in the request don't exist: `coast_rocks_04` and plain `coast_land_rocks`; the real ones are `coast_land_rocks_02/03/04`.

### 2.9 Walls, floor, texture scale (rank 9)

- **Floor, room and corridor:** Poly Haven **laminate_floor_02** (pale oak wide planks; real size 1.7 m per tile, so repeat = extent / 1.7, living floor about 8.2 × 4.7). Boards run along Z. Colour multiplier `#F3E6D3`, roughness map × 1.1. 2k on HIGH/ULTRA, 1k on LOW/MED. The travertine canvas comes off the floor.
- **Walls and ceiling:** Poly Haven **beige_wall_001** (smooth painted plaster, 3 m tile) normal (`normalScale 0.4`) and roughness 0.92, diffuse desaturated and used at 25% strength. Walls `#EDE6DA`, ceiling `#F2EEE8` (spec). Reject white_plaster_02; it has dirt patches.
- **Terrace deck:** Poly Haven **wood_planks_grey** (weathered silver-grey "seaside" planks, 1.5 m tile), warm tint `#C9BBA6`, boards along X.
- **Travertine:** ambientCG **Travertine009** 1K (island, coffee table, jambs, fin, fig planter), 1.0 m tile.
- **Oak for furniture and shelving:** Poly Haven **white_oak_veneer** 1k, 0.5 m tile.
- **Skirting:** 70 mm high, 10 mm proud, painted `#E3DACC`, around the whole room and corridor (merged into the plaster draw with vertex colour).
- **Ceiling shadow gap:** 25 mm, `#3A322A`, around the room perimeter where the walls meet the ceiling.
- Real-world scale check: floor boards should come out 0.18–0.22 m wide on screen. If they don't, fix the repeat, not the texture.

---

## 3. Poly Haven and ambientCG asset list

Models download from `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/<id>/<id>_1k.gltf` (plus its .bin and textures). The mesh is full resolution at every texture size, so decimate offline. All CC0; add courtesy credits to `ASSET_CREDITS.md`.

| Asset id | Type | Resolution | Tris (source → shipped HIGH) | Where it goes |
|---|---|---|---|---|
| syferfontein_18d_clear_puresky | HDRI | 1k (2k on ULTRA) | — | IBL only (§2.4) |
| coastal_cliff_02 | Model | 1k | 1.77M → 20k | Cliff under the house |
| coastal_cliff_01 | Model | 1k | 866k → 16k | Left and right cove arms |
| coastal_cliff_04 | Model | 1k | 2.88M → 8k | Headland waterline ×3 |
| coast_rocks_05 | Model | 1k | 1.45M → 2k | Waterline boulders ×6 |
| coast_land_rocks_03 | Model | 1k | 2.06M → 6k | Wet shelf ×2 |
| mid_century_lounge_chair | Model | 1k | 6.1k | Reading chair |
| painted_wooden_chair_01 | Model | 1k | 724 | Dining chairs ×6 |
| modern_ceiling_lamp_01 | Model | 1k | 5.6k | Pendants ×2 |
| modern_arm_chair_01 | Model | 1k | 8.9k | Study chair (optional) |
| potted_plant_01 | Model | 1k | 96k → 25k | Fig; terrace tree |
| potted_plant_02 | Model | 1k | 70k → 20k | Indoor plant |
| planter_box_02 | Model | 1k | 10.9k | Terrace planter |
| planter_pot_clay | Model | 1k | 3k | Micro |
| wooden_lantern_01 | Model | 1k | 8.3k | Terrace lantern |
| decorative_book_set_01 | Model | 1k | 113k → 15k | Bookshelves |
| ceramic_vase_02 / 03 / 04 | Model | 1k | about 2.5k each | Shelves |
| wooden_bowl_01 | Model | 1k | 14k → 3k | Island |
| lemon | Model | 1k | 4k → 1k each ×5 | Bowl |
| round_spectacles | Model | 1k | 11.8k → 2k | Study desk |
| laminate_floor_02 | Texture | 2k HIGH/ULTRA, 1k LOW/MED | — | Oak floor |
| beige_wall_001 | Texture | 1k | — | Walls, ceiling |
| wood_planks_grey | Texture | 1k | — | Terrace deck |
| white_oak_veneer | Texture | 1k | — | Furniture oak, shelves, slat ceiling |
| rough_linen | Texture | 1k (normal + roughness only) | — | Curtains, sofa |
| knitted_fleece | Texture | 1k | — | Jumper |
| curly_teddy_natural | Texture | 1k | — | Throw |
| ambientCG Travertine009 | Texture | 1K-JPG | — | Travertine |
| ambientCG Carpet016 | Texture | 1K-JPG | — | Rug |

---

## 4. Budgets

**Triangles, HIGH** (main pass plus shadow pass, since `renderer.info` counts both):

| Group | Main | Shadow |
|---|---|---|
| Ocean | 72k | — |
| Cliff, arms, boulders, shelf | 20 + 32 + 12 + 12 = 76k | — |
| Headland, ridge, lighthouse | about 32k | — |
| Architecture, frames, skirting | about 18k | 18k |
| Sofa, rug, curtains | about 20k | 12k |
| Furniture, plants, props | about 180k | about 150k (micro props don't cast) |
| Sky | 2k | — |
| **Total** | **about 400k** | **about 180k** → **about 580k** (≤750k) |

LOW: ocean 17k, nature 25k (LODs, no shelf, two boulders), furniture and plants at 50% LOD with micro props hidden (about 70k), shadow pass (1024 map, architecture and large furniture only) about 60k → **about 190k** (≤250k).

**Draws, HIGH:** architecture merged by material (plaster incl. skirting, oak floor, travertine, bronze, oak, deck, soffit: 7), glass 2, curtains 2, sofa and rug 2, furniture about 12, plants about 7, props about 8, nature about 11, ocean and sky 2, decals, motes, sailboat and gulls 4 → **about 57 main**, about 23 shadow, about 6 post → **about 86** (≤150). LOW: drop micro props, grass, AO, shelf and the spot light → **about 55** (≤80).

**GPU memory, HIGH:** KTX2 is required, not optional. About 23 texture sets at 1k plus the 2k floor come to about 350 MB as RGBA8 with mips, but about 90 MB as KTX2 (ETC1S for albedo, UASTC for normals). At DPR 1: MSAA 4× target 99.5 MB, post targets about 50 MB, textures 90 MB, geometry about 30 MB, shadow 16 MB, PMREM and AO about 16 MB → **about 300 MB**. At DPR 1.5 the 4× MSAA target alone is about 224 MB, so under D-039 HIGH at DPR 1.5 drops to 2× MSAA (about 112 MB), for a total of about 375 MB. That is tight, so measure it with the S5-10 estimator. If the toolchain can't produce KTX2, props go to 512 px WebP and cliffs stay 1k (about 150 MB of textures), and HIGH at DPR 1.5 must use SMAA.

---

## 5. Must-match reference frames

All at 62° vertical FOV, 16:9, pitch 0 unless stated, default time of day.

**F1 — Spawn** (0, 1.62, −8.2), looking +Z.
The corridor walls are neutral warm grey (`#6F665B` near, `#857A6D` at the mouth), with a warm floor pool under the downlight and the oak slat lines running toward the mouth. The soffit is a dark band `#2E251E` across the top of a 2.2 × 2.1 m portal. In the portal: the upper 45% is blue-grey sky (`#A9BCCB` fading to `#C9CDCB` at the horizon), a crisp horizon at about 48% of the portal height, sea `#2F5566` below with one bright glitter fleck at the right edge, the rail cap a thin dark line, and the curtain edges just visible at both sides (the right one warmer). Nothing in the portal is white or clipped. The sea must read as sea from here.

**F2 — Reveal V2** (0, 1.62, −3), looking +Z.
The horizon runs across the vertical middle of the frame. Dark bronze mullions at x ±2 and ±4 divide the 12 m glass wall. The sky goes from `#D6D4CC` at the horizon to `#93AEC2` at the top of the glass. The headland is a low grey-green ridge at the far left (22°–55° left), clearly standing in the water with a pale foam line, lighthouse on its tip. The glitter lane starts about 22° right and widens toward the horizon. The right curtain glows `#F4DFC0`; the left one is cool off-white with visible pleats. Sun patches on the oak floor carry mullion shadows that fall toward +X and −Z. The ceiling brightens toward the glass, with no hot spot anywhere. The sun disk is hidden or a thin sliver at the lintel. The sofa sits lower left and the island lower right; the centre is empty.

**F3 — Hero-sea with Notes** (2.2, 1.62, 0.6), looking at (5.1, 1.45, 3.9).
The Notes pane (0.85 × 1.08 m) sits against away-from-sun sky and sea, with the horizon crossing behind it at about 65% of its height. The headland ridge is visible on at least one side of the pane. The glass-to-wall corner at x 6 lines up with the pane's outer edge. Text contrast against what's behind is at least 3:1. The closed-panel glass shows a faint sky reflection at this angle.

**F4 — Balustrade looking down** (−2, 1.62, 8.4), pitch −35°, looking +Z.
The rail glass shows a fresnel edge highlight and a slim bronze cap. Below, the cliff face drops about 6 m to the water with a darker wet band about 0.6 m tall at the waterline. Foam laces around the boulders and the wet shelf. Near water is teal `#1E4D56` with depth. The water colour is continuous from the cliff foot to the horizon, with no seam anywhere, and the same above and below the cap line.

**F5 — Looking back from the terrace** (0, 1.62, 8.3), yaw 180° (looking −Z).
The weathered grey deck is lit by the low sun from behind the camera, with long chair shadows toward −Z. The facade shows bronze frames, the closed glass reflecting the sky, and the warm interior behind it: the floor lamp's pool, curtains edge-lit, the dark ceiling-pocket line and the ceiling brightening toward the glass. The bench sits solidly on its plinth, and contact shadows are under every piece.

---

## 6. Build order and checkpoints

1. Sky, fog, ocean mesh and colours (§2.1), plus the seam diagnostic. Screenshot F2 and F4.
2. Headland and cove (§2.2, §2.3). Screenshot F2 and F4.
3. Lighting (§2.4). Screenshot F1, F2 and F5.
4. Glass, corridor, curtains (§2.5–2.7). Screenshot all five.
5. Furniture and surfaces (§2.8, §2.9). Screenshot all five, HIGH and LOW, with `renderer.info` and the memory estimate for each.

---

SUMMARY: A ranked, buildable art brief for Seaside House art pass 2. It fixes the monochrome sepia look first (sky, fog, sea), then the headland, the ground under the house and the lighting, then the glass, corridor, curtains, furniture and surfaces, with exact colours, positions, assets and budgets.

WHAT WAS DONE: Reviewed the 12 PR #5 screenshots and the scene, level, shader and curtain code; traced each visual problem to its code cause; checked Poly Haven and ambientCG ids, sizes and triangle counts through their public APIs; wrote this brief.

FILES / SYSTEMS AFFECTED: New `docs/phase-a/AURA_ART_PASS_2.md`. For the builder: `Scene.tsx`, `level.ts`, `furniture.ts`, `art/shaders.ts`, `art/curtains.ts`, the asset pipeline (decimation and KTX2), `ASSET_CREDITS.md`.

IMPORTANT DECISIONS: Blue-grey sky with a warm sun side; FogExp2 `#D6D4CC` at 0.00048; one shared sky/horizon function for sky, sea and fog; a polar-grid ocean to about 3.8 km; headland at 1.25–2 km as a sunk procedural ridge with coastal_cliff_04 at the waterline; a coastal_cliff_02/01 cove under the house; HDRI `syferfontein_18d_clear_puresky` for IBL only; ceiling point light and hemisphere light deleted; room-occlusion factor in place of the missing bake; bronze `#3B2F25` frames and fresnel glass; pleated linen curtains with world-space backlight; pale oak floor (laminate_floor_02) instead of travertine; most Poly Haven furniture rejected on style, with the sofa, tables, island, stools, benches and terrace chairs built procedurally.

RISKS: The balustrade seam's cause isn't proven from the code; it needs the diagnostic in §2.1. Heavy decimation ratios can damage cliff silhouettes. Memory at HIGH DPR 1.5 is tight (about 375 MB) and depends on KTX2. The reading-chair collider change and the optional dining-chair boxes touch collision and need Sentinel's re-check.

KNOWN LIMITATIONS: The expected colour values are targets from the design, not measured from a render. The room-occlusion factor is a stopgap for the spec's lightmap bake. potted_plant_01 stands in for the olive tree. The sun disk still shows a 0.17° sliver at the lintel unless D-027 moves the sun to 12.5°.

RECOMMENDED NEXT ACTION: The Master approves the brief and the builder downloading the listed CC0 files; the builder does step 1 (sky, fog, sea and the seam diagnostic) and sends F2 and F4 screenshots before going further. The Master decides whether to amend D-027 to a 12.5° sun.
