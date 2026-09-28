# AURA_WORLDS — Environmental Language & Seaside House (Phase A)
Author: Aura (World, Atmosphere & Experience) · 2026-09-28 · Status: design only, for Ghiland Master synthesis
Scope: Alpha 0.1. All numbers are starting values to be tuned in the Phase B greybox and validated by Sentinel. Nothing here has been built or measured yet.

---

## 1. Ghiland environmental language (all worlds)

### Palette logic
- The sky drives the palette. Fog colour, ambient fill, UI frame tint and the colour of distance all derive from the current sky, so a world is always one coherent temperature.
- Each world has one dominant temperature and one counter-temperature: warm light with cool shadow by day, cool ambient with warm practical light at night.
- Large surfaces are low saturation and mid value. Saturation lives in small natural things: a lemon, a book spine, a flower, a boat hull.
- Never pure white (albedo ceiling about #F2EEE8) and never pure black (floor about #141210). Whites are warm off-whites; darks are warm charcoal or deep blue.

### Light philosophy
- One clear key light with a direction and a time of day. Every light is motivated: if there is a glow, there is a lamp, a window or the sun causing it.
- Soft shadows, warm bounce, gentle contrast. Contrast comes from composition (a bright opening in a calmer room), not from darkness.
- Exposure adapts slowly, like eyes do. Stepping outside or looking at the sea should take a second to settle.
- Comfort over realism: we push toward the flattering version of real light, never the harsh one.

### Motion rules
- One wind per world. Everything that moves in air (plants, curtains, dust, clouds, audio) reads the same wind.
- Everything moves slowly and for a reason: wind, water, time, or a living thing.
- The periphery is alive and the centre is calm. Motion sits at the edges of the frame.
- No visible loops. Natural motion layers at least two frequencies; anything repeating shorter than about 20 s must be randomised.
- UI never moves on its own. Only the user moves windows.

### Sound rules
- Every sound has a place. Nature and room sounds are positioned in space; only very distant beds are non-positional.
- Nothing is ever fully silent: interiors have room tone.
- No audible loops. Beds are long and crossfaded; events are re-sequenced from variations.
- Distance means low-pass filtering and quieter, softer attack, not just lower volume.
- Rare events are measured in minutes, not seconds.
- The world is quieter at night, not only darker.

### Framing rules
- Every world has a horizon or a long sightline.
- Entry uses compression then release: a smaller, dimmer space opening into the view.
- The "wow" moment happens within about 15 s of spawning, without instruction.

### What we never do
Grid floors. The default Three.js sky, default lighting or the grey-blue "demo" look. Uniform grey fog. Pure white or pure black. Bloom on everything, lens flares, chromatic aberration, heavy depth of field. Head bob. Particles or sparkles with no physical cause. Showroom-perfect staging with nothing out of place. Ad luxury (champagne, logos, perfect cushions). Music playing by default. Visible texture tiling. Glowing neon UI edges, purple gradients, heavy frosted glass.

---

## 2. Seaside House spec

### Concept
A single-storey modern house cantilevered over a rocky cove, facing open sea to the west-southwest. Warm minimal architecture: lime plaster, pale oak, travertine, dark bronze frames, one enormous glass wall. It belongs to someone who actually lives there: a half-read book, a jumper over a chair, a cup left on the table, sand on the terrace.

### Layout and dimensions
Coordinate frame for the spec: metres, Y up, +Z points toward the sea, origin at the centre of the living room's back wall line (z = -3.5 is the back wall).

| Zone | Extent (x × z) | Ceiling | Notes |
|---|---|---|---|
| Entry corridor | x −1.1…1.1, z −9…−3.5 (2.2 × 5.5 m) | 2.4 m, oak slats | Dim, narrow, warm. Compression before the reveal. |
| Living volume | x −7…7, z −3.5…4.5 (14 × 8 m) | 3.2 m, plaster | Open plan: lounge left, kitchen/dining right, clear centre. |
| Study nook | x −7…−5, z −3.5…0 | 3.2 m | Desk under a narrow side window framing the headland. Natural "home" spot for the Ghiland Screen. |
| Glass wall | x −6…6 at z = 4.5 | full height | Six 2 m sliding panels. The two at x −4…0 are open, with sheer linen curtains, so the straight path from the reveal point walks into open air. The panel at x −6…−4 stays closed and backs the hero pin anchor. |
| Terrace | x −7…7, z 4.5…9 (14 × 4.5 m) | open sky | Teak deck cantilevered over water. Glass balustrade 1.05 m high. |
| Sea surface | y = −6.0 | | 6 m below the deck. Rocks at the base on both sides. |

Walkable area is about 100 m² inside, 63 m² of terrace and 12 m² of corridor, all on one level. No stairs in Alpha 0.1: they add controller risk and nothing to the feeling. Colliders are invisible and follow the walls, furniture footprints and the balustrade, with smooth wall-sliding.

Furniture placement: lounge (x −6…−2) has a low linen sofa facing the sea, a wool rug, a travertine coffee table, a floor lamp and a bookshelf on the back wall. Kitchen (x 2…7) has a travertine island with two stools, open oak shelving and a dining table for six near the glass with two pendant lights. Centre (x −2…2) stays empty so the path from the corridor to the glass is a straight, unobstructed line. One bouclé reading chair sits by the glass, just right of centre. Terrace has two lounge chairs, a built-in bench along the left edge, a planter with an olive tree and grasses, and an outdoor lantern.

### Spawn and the reveal
- Spawn at (0, eye height, −8.2), facing +Z, in the corridor.
- Entry transition (ruling, follows Pixel): clicking the Seaside card unlocks browser audio and starts the sea, muffled, under the loading backdrop. There is no black screen. When the scene is ready the backdrop dissolves into the corridor view over about 1 s, so the sound arrives first and the image follows.
- From spawn you see a vertical sliver of bright sea-light at the end of the corridor, beside a freestanding travertine fin wall at z ≈ −3.5 that blocks the full view. You hear the sea, filtered.
- About 4 m of walking (3 s) brings you past the fin. The ceiling lifts from 2.4 to 3.2 m, the corridor widens into 14 m of room, and the whole 12 m glass wall opens with the horizon at eye level. Auto-exposure dips as the brightness hits you and then settles. This is the "wow".
- From the reveal point to the open panel is 8 m, about 6 s at walking speed. The sea gets louder and brighter with every step.

### Key sightlines
1. Spawn: the sliver of light at the end of the corridor.
2. Reveal point (0, 1.62, −3): the full glass wall, horizon at eye level, sun glitter on the water about 20–25° right of centre.
3. The open panel: curtains moving inward across the view, which is where wind first becomes visible.
4. The balustrade: looking down 6 m at waves washing over the rocks. This is the motion and sound peak.
5. Looking back from the terrace: the warm interior with lamps on. This sells "home" and is the best spot to show a pinned window from outside.
6. The study window: the distant headland with a lighthouse, a smaller, quieter composition.

Horizon dressing: a low headland silhouette to the left (south), a sailboat that crosses slowly, and layered clouds. Nothing on the right third, so the sun path stays clean.

### Time of day for Alpha 0.1
- Default: late afternoon, about 40 minutes before sunset. Sun elevation about 12°, positioned over the sea 20–25° right of the view axis, so the glitter path is visible from the living room without blinding. Sun colour about 3800 K (#FFC98F).
- The default drifts very slowly (a few degrees over an hour) so the light is never frozen.
- Stretch goal, ships only after the core loop is validated: "Slow sunset", animates sun elevation from 12° to −3° over about 8 minutes. Sky, fog, exposure and sea colour follow. Interior lamps turn on at 2° elevation; the lighthouse starts sweeping at 0°. It works on every tier because it is only changing uniforms.

### Lighting setup
- Sun: one directional light, the only real-time shadow caster. The house is small (about 30 × 20 m including terrace), so one tightly fitted shadow camera is enough and cascades aren't needed. The window-frame shadows travelling across the oak floor are the key interior image; keep them real-time so the sunset works.
- Sky: a custom gradient sky dome (zenith, horizon, sun glow terms driven by sun elevation) with two or three scrolling cloud layers. Do not use the stock examples `Sky` as the visible sky; it reads as a demo.
- Environment lighting: a late-afternoon clear-sky HDRI (2k, CC0, e.g. Poly Haven) used for image-based lighting and reflections only, not as the visible background, at about 0.5–0.7 intensity and tinted by the time-of-day uniform during sunset.
- Interior: bake ambient occlusion and indirect sky fill into lightmaps for the architecture (about two 2048 atlases). Do not bake the sun, because it moves. During sunset, multiply the lightmap by a colour and intensity uniform. Practical lights (floor lamp, pendants, lantern) are emissive surfaces plus at most two small real-time point lights without shadows.
- Fog: exponential, colour always sampled from the sky's horizon colour, low density so the headland softens and the horizon merges. The sea shader adds its own height haze for the horizon line.
- Tone mapping: AgX (Three.js r160 and later), with ACES Filmic as fallback. AgX handles the warm sun and bright glass more gently.
- Exposure: simulated auto-exposure with no luminance readback. The target comes from the player's zone (corridor, interior or terrace) and how much the view faces the glass (dot product of view direction and +Z), ranging from about 1.2 in the corridor to 0.9 facing the sun, damped over about 1.5 s.
- Post-processing: anti-aliasing (MSAA or SMAA), subtle bloom with a high threshold so only the sun disk and water glints bloom, a faint vignette of about 0.15, and very light grain on HIGH and above. No depth of field, no chromatic aberration, no lens flares.

### Materials list
| Material | Where | Notes |
|---|---|---|
| Pale oak, wide planks | Floor, corridor slats, shelving | Matte, roughness variation, very subtle wear paths near the sofa and the glass. |
| Warm lime plaster (#EDE6DA) | Walls, ceiling | Trowel variation in the normal map. Never flat white. |
| Honed travertine | Fin wall, coffee table, kitchen island | Soft pores, slight warm variation. |
| Dark bronze aluminium | Window and door frames | Thin profiles, satin roughness. |
| Architectural glass | Glass wall | Mostly invisible. No transmission material (too costly). Very low base opacity plus a fresnel reflection of the environment at glancing angles, and a faint smudge and dust layer that only shows when the sun hits it. |
| Sheer linen | Curtains | Backlit glow faked by sun direction against the curtain normal. Must feel translucent. |
| Heavy linen, wool, bouclé | Sofa, rug, reading chair, throw | Soft sheen and fibre roughness. No perfect cushions. |
| Weathered teak | Terrace deck, bench | Silvering at the edges, warmer near the door. |
| Low-iron glass with steel cap | Balustrade | Near invisible; the cap catches the sun. |
| Matte stoneware | Cups, bowls, vase | Slight glaze variation. |
| Wet rock | Cove below | A darker wet band that moves with the wave height, lighter dry rock above. |
| Plant foliage | Olive, fiddle-leaf fig, monstera, grasses | Cards for grasses and olive leaves with some back-lit translucency. Alpha-to-coverage with 4× multisampling on HIGH and ULTRA; alpha-test with sparser foliage on LOW and MED. |

Textures are KTX2 (Basis) compressed; geometry is meshopt or Draco compressed.

### Detail layers
- MACRO: the cliff and cove, open sea to the horizon, the headland and lighthouse, the house volume with its cantilevered terrace, the sun low over the water, cloud layers.
- MESO: sofa, reading chair, dining table and pendants, kitchen island, bookshelf, study desk, olive tree and grasses on the terrace, fiddle-leaf fig and monstera inside, lounge chairs, the glass balustrade, the sailboat.
- MICRO: a cup with a coffee ring on the dining table, one book open face-down on the sofa arm, a knitted jumper over a chair back, reading glasses on the desk, a bowl of lemons on the island, a little sand and a few dried olive leaves near the terrace door, a slightly crooked stack of books, faint fingerprints on the glass near the open panel, a towel over the terrace bench.
- AMBIENT: dust motes in the sunbeams inside, curtains breathing inward, sun glitter on the water, the reflection of the sky sliding across the glass as you move, shadows of leaves moving on the terrace deck, warm haze at the horizon.
- TEMPORAL: gusts every 15–45 s that travel visibly from the terrace grasses to the curtains; clouds occasionally softening the sun (a gentle exposure and shadow-contrast dip); the sailboat crossing over about 10 minutes; gulls passing; a larger wave striking the rocks every few minutes with a spray burst and a matching sound; the slow drift of the sun.

### Procedural vs GLB
- Procedural (shaders or code): the ocean, sky dome and clouds, fog and haze, sun glitter, dust motes, the wind field, curtains (a subdivided plane with vertex animation), grasses (instanced), leaf flutter (vertex shader on the GLB plants), gulls (simple vertex-animated birds), the sailboat's path and bob, the lighthouse beam, rock foam and spray.
- GLB (authored in Blender): the house architecture as one GLB with lightmap UVs, the furniture set, the plants, rocks and cliff, the headland silhouette, the sailboat model, and the props (the micro layer as one batched GLB). Initial compressed download target is under 25 MB, with micro props and ULTRA textures streamed after first paint.

### Quality tiers
| Feature | LOW | MED | HIGH | ULTRA |
|---|---|---|---|---|
| Render scale | 0.75, pixel ratio 1 | 1.0, pixel ratio 1 | pixel ratio up to 1.5 | pixel ratio up to 2 |
| Sun shadow | 1024, basic filtering | 2048, PCF | 2048, soft PCF | 4096, soft, plus contact shadows |
| Ocean | ~16k vertices, 4 waves, 1 detail normal, no foam | ~32k, 6 waves, 2 normals, rock foam | ~65k, 8 waves, rock and crest foam | ~130k, 12 waves, crest back-light tint |
| Post-processing | Tone mapping only | + anti-aliasing, vignette | + bloom, grain | + ambient occlusion, higher-quality bloom |
| Dust motes | 0 | 100 | 250 | 500 |
| Grass instances | 30% | 60% | 100% | 100% |
| Foliage edges | Alpha-test, sparser | Alpha-test, sparser | 4× MSAA + alpha-to-coverage | 4× MSAA + alpha-to-coverage |
| Curtain mesh | 12 × 16 | 24 × 32 | 32 × 48 | 48 × 64 |
| Clouds | 1 layer | 2 layers | 3 layers | 3 layers + cloud shadows on the sea |
| Gulls (visual) | 0 | 1 | 2 | 3 |
| Micro props | Hidden beyond 6 m | Full | Full | Full |
| Textures | 1k | 2k | 2k | 4k hero surfaces |

What LOW cuts: bloom, grain, dust, foam, most grass, the visual gulls, extra cloud layers, far micro props and shadow softness. What no tier ever cuts: sun direction and colour, sky-derived fog, moving curtains (a cheaper mesh), moving water, the full sea soundscape, and the reveal.

Scene budgets (HIGH, to be validated): under 120 draw calls, under 400k triangles in view, under 150 MB texture memory, 60 fps at 1080p. MED targets 60 fps on a typical integrated GPU (Intel Iris Xe or Apple M1 class).

---

## 3. Ocean and wind

### Ocean
Choice: a custom Gerstner-wave shader, not the stock `Water` or `Water2`. Both stock versions render a second planar reflection pass, which doubles the scene cost, and they are the most recognisable "Three.js demo" water.

- Mesh: a radial grid, dense near the house and sparse toward the horizon, about 2 km radius, with a horizon skirt.
- Vertex: 4–12 summed Gerstner waves (by tier). The long swell comes from the open sea toward the cliff (wavelength 20–60 m, amplitude up to 0.35 m); shorter chop follows the wind direction (wavelength 3–10 m). The sea is calm but never still.
- Fragment: two scrolling detail normal maps at different scales and directions; fresnel blend between deep water colour (deep teal-blue, warming at sunset) and the sky colour sampled analytically from the same sky model, so the sea always matches the sky; a sharp sun specular with high-frequency normals for the glitter path; the horizon fades into the fog colour.
- Rocks: a baked distance-to-shore texture drives foam that pulses with the wave phase, plus a periodic large-wave spray burst (particle sprite) synchronised with a sound event.
- No planar reflections. The house is behind the viewer when looking out, so the sea only needs to reflect the sky.
- The same Gerstner function runs on the CPU (a few samples per frame) for the sailboat's bob and for timing wave-on-rock sounds, so sight and sound agree.

### Wind (shared system)
One global wind in the environment state, exposed to shaders as uniforms and to audio as values.

- Direction: an onshore sea breeze, blowing from the sea into the house, as real afternoon coastal wind does. So the curtains billow inward, which is also the more beautiful image.
- Base strength about 0.3 (0 to 1), with slow noise at 0.05–0.2 Hz.
- Gusts: random events every 15–45 s. Each rises over about 1.5 s, holds 2–4 s, and falls over about 3 s, with amplitude 0.3–0.7.
- A gust travels. Each consumer samples the gust at a time offset by its position along the wind direction, with a front speed of about 6 m/s. The terrace grasses move first, the curtains about a second later, then the indoor leaves slightly.
- Uniforms: wind direction, strength, gust value, time, plus a small tiling noise texture for spatial variation.
- Consumers:
  - Curtains: pinned at the top rail, with displacement growing toward the hem, billowing along the wind, plus a faster flutter at the hem. Maximum inward travel 0.35 m so they never clip through furniture.
  - Plants: stiffness from vertex colour (trunk 0, branches low, leaves high) with leaf flutter at a higher frequency.
  - Grasses: bend plus a travelling wave.
  - Dust, clouds and sea chop: drift and speed scale gently with the wind.
  - Audio: wind bed gain and filter, curtain rustle and leaf rustle triggered at gust peaks.

---

## 4. Audio

### Layers and placement
1. Ocean
   - Waves on rocks: two positional sources at the rock bases below the terrace (left and right, y ≈ −6). This is the most important sound in the world. It uses HRTF panning.
   - Open sea wash: one wide positional source about 40 m out.
   - Distant surf: a quiet non-positional stereo bed for fill.
   - Inside the house, ocean sources pass through a low-pass filter whose cutoff depends on distance to the open glass panels (roughly 3 kHz near the open panel, about 900 Hz deep in the room or the corridor). The open panels behave as the opening sound comes through.
2. Wind
   - A non-positional stereo bed, full on the terrace and about 25% with low-pass inside, following wind strength.
   - A gust layer that crossfades in with each gust.
   - Curtain fabric rustle positioned at the curtains; leaf rustle at the olive tree and the indoor plants.
3. Gulls
   - Single calls from random positions in a hemisphere over the sea, 30–150 m away, every 25–90 s, sometimes two in a row. Farther ones are quieter and more filtered.
4. House ambience
   - Quiet room tone inside so the interior is never dead silent.
   - A faint fridge hum positioned at the kitchen.
   - Footsteps (see section 5).
5. Rare events (minutes apart)
   - A distant ship horn every 6–15 minutes.
   - A larger wave on the rocks every 2–5 minutes, synchronised with the visual spray.
   - A small motorboat passing far out, panning across, every 10–20 minutes.
   - A church bell from the headland, very faint, rarely.

### Avoiding obvious loops
- Beds are long (at least 2–3 minutes) and stream from compressed files rather than decoding into memory. Two streams play offset and crossfade at random points. Wave variations are short one-shots (about 1–4 s, mono) decoded into memory.
- Waves are re-sequenced, not looped: cut recordings into individual wash events (6–10 variants) and schedule them at intervals matched to the visual swell period (about 6–9 s) with jitter, random gain of ±3 dB, and playback rate of 0.95–1.05.
- One-shots come from pools with no repeat of the last N picks.
- Slow random modulation on bed gain and filter cutoff.
- Rule: no file shorter than 60 s may loop audibly.

### Mix and budget
- 12–16 simultaneous voices maximum.
- A gentle master compressor.
- Sound fades in on entry as described in the spawn section.

### Sound assets to find
Describe-and-source list only. No specific files are named, and each file's licence must be checked individually.

| Asset | What to look for |
|---|---|
| Calm sea from height | 3+ min stereo, recorded from a cliff or terrace, not a roaring beach. Gentle wash, no people, no wind rumble on the mic. |
| Waves on rocks, close | 6–10 separate washes and splashes on rock, clean starts and tails. |
| Light steady wind | 2+ min outdoor breeze, no howling, no mic buffeting. |
| Wind gusts | 4–6 swells, 4–8 s each. |
| Fabric flutter | 4–6 variants of light curtain or linen movement. |
| Leaf rustle | 4–6 short variants, olive or similar small leaves. |
| Gull calls | 8–12 single calls, mid and distant. Ideally yellow-legged gull (Mediterranean). |
| Interior room tone | 1+ min very quiet room. |
| Fridge hum | 1 min, soft. |
| Footsteps | 8+ each for soft shoes or bare feet on wood floor, weathered wood deck, and rug. |
| Distant ship horn | 2–3 variants, far and reverberant. |
| Distant motorboat pass | 1–2 long passes. |
| Distant church bell | 1–2 single strikes with tail. |

Suggested sources:
- Freesound.org: prefer CC0 or CC-BY and avoid NonCommercial.
- The Sonniss GDC game audio bundles: royalty-free and usable commercially.
- Pixabay sound effects, under the Pixabay licence.
- Zapsplat: free with attribution, or paid.
- Paid libraries such as Soundly, Epidemic Sound or Artlist if budget allows.
- BBC Sound Effects is a warning case: its RemArc licence is non-commercial only, so don't use it if Ghiland may go commercial.

UI sounds belong to Pixel.

---

## 5. Camera and movement feel
- Eye height 1.62 m. Collision capsule 1.75 m tall, 0.3 m radius.
- Field of view 62° vertical (about 91° horizontal at 16:9), adjustable from 55 to 75 in settings.
- Walk speed 1.35 m/s. Holding Shift gives a "stroll faster" speed of 2.2 m/s, never a sprint. Backward speed is ×0.8 and sideways ×0.85.
- Acceleration uses exponential smoothing with a time constant of about 0.15 s (full speed in about 0.45 s). Stopping uses about 0.2 s, a slight glide that never feels icy.
- Mouse look uses very light smoothing (30–50 ms time constant). Pitch is clamped to ±80°. No camera roll.
- Breathing: after 2 s standing still, fade in a vertical motion of about 4 mm at 0.22 Hz (about 13 breaths a minute) with about 0.08° of pitch.
- Walking: no head bob. At most a 6 mm smooth vertical motion at step frequency.
- Reduce motion: an accessibility setting sets breathing and walking motion to zero.
- Footsteps: triggered by distance travelled, with a stride of 0.7 m (about 1.9 steps per second at walking speed). Surface-aware (oak, teak deck, near-silent on the rug), very quiet, with random variant and ±4% pitch, plus a softer settling step when stopping. They are most audible inside, where it's quiet, and that makes the house feel inhabited.
- Stretch goal, not required for Alpha 0.1: sitting on the sofa or a terrace lounger, lowering the eye to about 1.1 m over 0.8 s and leaning the audio mix toward the sea.

---

## 6. How floating UI windows exist in the world
Pixel owns interaction and content design. This section covers how a window sits in the light and space of the world.

- Physical presence: a window is a thin pane in world space with no visible thickness beyond a 1–2 mm edge highlight. Corners are rounded. Pinned windows keep a real-world size, about 60–90 cm wide at a 1.5–2 m viewing distance.
- Content stays unaffected by world lighting. Text and app content render with tone mapping off and are excluded from auto-exposure and bloom, so readability never changes when the light does.
- The frame responds to the world. The backplate takes a 10–15% tint from the local environment light (sun and sky colour), so frames warm up at sunset. A thin fresnel rim on the sun-facing edge catches the light.
- Opacity: the backplate is 88–94% opaque, not heavy frosted glass. There is no real-time background blur by default because it's expensive; ULTRA could use a blurred background taken from a lower-resolution copy of the scene. Light theme is warm off-white (about #F4EFE7), dark theme warm charcoal, never pure white at dusk.
- Occlusion (ruling): windows are DOM, so they can't be depth-tested. A raycast from the camera fades a pinned window out when a wall, the fin or furniture blocks it. Fade over about 200 ms, never a hard cut. Glass never occludes, so windows pinned inside stay visible from the terrace. This is what makes "it stays there" believable. Only focus and overlay modes draw on top.
- Grounding: a window pinned within about 0.3 m of a surface (wall, table, glass) casts a very soft contact darkening on it. Windows never cast hard shadows and never float with drop shadows in mid-air.
- Night: overall UI brightness drops to about 85% after sunset so windows don't glare against a dim room.
- Motion: appearance is a 250 ms fade with a 2 cm settle, never a pop. Windows do not sway with the wind or bob.
- Suggested pin spots in the Seaside House (for Pixel's snap hints and the success test):
  - Hero pinAnchor (authored; pinning within 1.5 m snaps here, glass is never a snap surface): centre at about (−5.1, 1.45, 3.9), in front of the closed panel at x −6…−4, 0.6 m from the glass, angled about 15° toward the room. This is the hero spot for the Notes test.
  - Size check at 500–550 px per metre: a Notes window of about 440 × 560 px pins at roughly 0.8 × 1.05 m, spanning about 0.9–1.95 m in height. Centred on the open panels it would cover most of the view, which is why the anchor sits over the closed panel. From the reveal point the note reads on the left third, the open panels and horizon hold the centre, and the sun glitter sits on the right. That makes a balanced frame instead of a blocked one. Recommend Pixel caps the default pinned Notes size at about 0.8 × 1.05 m for this anchor. The curtains' 0.35 m inward travel stays clear of the pane.
  - Over the dining table.
  - Above the study desk.
  - At the terrace balustrade. It's the brightest spot, so Sentinel should test legibility there.
- Never: glowing outlines, coloured gradients, sparkle transitions, or windows that change the world's exposure.

---

## 7. Preview cards: NY Balcony and Golden Hour Farm
Shared card grammar, matching the Seaside House card:
- One still frame at 16:10 with the horizon in the upper third, one warm light source and one sign of life.
- On hover, a slow living-photo loop where exactly one or two elements move, plus an optional low-volume sound hint.
- The label is understated ("Alpha 0.2"); typography is Pixel's.
- Cards should come from our own greybox renders or commissioned or painted concepts. They must not look like generic AI art.

### NY Balcony
- Setting: a high-rise balcony at blue hour, just after the rain has stopped.
- Details: a wet railing catching city light, a distant water tower and rooftops, steam from a rooftop vent, a small metal table with a mug and a folded blanket, and warm tungsten light spilling from the apartment behind.
- Palette: deep blue-violet sky fading into sodium-orange city glow, with warm interior light as the counter-temperature.
- Motion: a blinking aircraft light crossing, steam drifting.
- Sound hint: a soft traffic hush, a far softened siren, drips.

### Golden Hour Farm
- Setting: a wooden farmhouse porch at very low sun over rolling wheat fields, with a line of cypresses on a far ridge.
- Details: a porch swing, a glass of lemonade sweating on the rail, dust hanging in the light, long blue shadows, and swallows.
- Palette: honey gold and straw with sage green, and cool blue shadows as the counter-temperature.
- Motion: a wind wave rolling through the wheat, swallows passing.
- Sound hint: crickets, wind in the wheat, a distant cowbell.

---

## Handoffs
- Atlas: an `EnvironmentState` contract shared by all worlds. Slow-changing values live in the store: time of day or sun elevation, sun direction and colour, sky zenith and horizon colours, fog colour and density, wind (direction, strength, gust), exposure target, quality tier and audio zone. Per-frame values live in refs and uniforms, not React state. Also needed: an audio zone and portal concept (interior, terrace, the open panels).
- Forge: the controller numbers from section 5, the Gerstner ocean, the wind uniforms and consumers, simulated auto-exposure, the tier table, and the audio scheduler for beds, re-sequenced waves and one-shot pools.
- Pixel: the UI-in-world rules in section 6 and the suggested pin spots.
- Sentinel: the budgets in section 2, the "never" list in section 1, legibility at the terrace pin spot, and loop detection in the audio after 20 minutes.

---

## 8. Selected sound assets (licence-checked)
Checked on 2026-09-28. Every row below was verified by opening its public page (title, author, licence, duration and format as shown there). Nothing was downloaded. All picks still need a listening pass before use.

| Category | Primary? | Title (as on page) | Author | Source URL | Licence | Duration / format (if shown) | Account or payment needed to download | Notes |
|---|---|---|---|---|---|---|---|---|
| Ocean bed | Yes | breakwater.aif | FranCirujeda | https://freesound.org/people/FranCirujeda/sounds/207787/ | CC0 | 5:02, AIFF, stereo, 48 kHz / 16-bit | Free Freesound account ("Login to download"); no payment | Page: calm Mediterranean afternoon at Gandía, waves on a breakwater. Recorded at shore level, so low-pass and lower it to read as "from 6 m up". Loop with a long crossfade. |
| Ocean bed | Alt | CFX-20130331-UK-DorsetSeaCliff02.wav | Carlvus | https://freesound.org/people/Carlvus/sounds/182605/ | CC0 | 2:39, WAV, stereo, 96 kHz / 24-bit | Free Freesound account; no payment | "Sea Cliff Ambience". The only true cliff-height perspective found. One of six takes (IDs 182603 to 182608, 2:00 to 2:39 each); chain two takes to get past 3 min. English Channel, not Mediterranean. |
| Ocean bed | Alt | waves and seagulls.wav | juskiddink | https://freesound.org/people/juskiddink/sounds/149488/ | CC BY 4.0 | 4:33, WAV, stereo, 44.1 kHz / 24-bit | Free Freesound account; no payment | Page: calm day, small waves on sand, gulls on a cliff 200 m away, "loops cleanly". Sandy beach, not rock. Attribution: "waves and seagulls.wav" by juskiddink, https://freesound.org/people/juskiddink/sounds/149488/, CC BY 4.0. |
| Wave variations | Yes | Ocean's quiet lapping on rocks | bruno.auzet | https://freesound.org/people/bruno.auzet/sounds/654444/ | CC0 | 3:48, WAV, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Very small waves on rocks, close, AB pair of MKH20s. Cut into 6 to 10 soft wash events for the near rocks under the terrace. |
| Wave variations | Alt | Waves_Crashing_Rocks_IT.wav | uniuniversal | https://freesound.org/people/uniuniversal/sounds/620213/ | CC0 | 3:32, WAV, stereo, 44.1 kHz / 32-bit | Free Freesound account; no payment | Mediterranean waves on Italian rocks. Bigger washes; cut 4 to 6 louder events for gust or swell moments. |
| Wave variations | Alt | Wave on the rocks in Dinard (Britain, France) | felix.blume | https://freesound.org/people/felix.blume/sounds/530186/ | CC0 | 2:58, WAV, stereo, 96 kHz / 24-bit | Free Freesound account; no payment | Close ORTF at 50 cm from the water; page notes faint distant beach and city noise. Clean source for extra single events. Atlantic. |
| Wind | Yes | a gentle breeze, wind 1 | mario1298 | https://freesound.org/people/mario1298/sounds/181250/ | CC0 | 2:36, WAV, stereo, 48 kHz / 32-bit | Free Freesound account; no payment | Steady breeze bed. Page gives no location or detail, so check for mic buffeting. Five more takes exist (IDs 181251 to 181255, 0:32 to 2:04) for variation. |
| Wind | Alt (gusts) | wind light calm soft breeze deep big gusty.flac | kyles | https://freesound.org/people/kyles/sounds/454360/ | CC0 | 1:15, FLAC, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Cut 3 to 5 gust swells to layer over the bed when a gust passes. |
| Wind | Alt | Sea Breeze Birds Wind.wav | jordir | https://freesound.org/people/jordir/sounds/360448/ | CC0 | 1:27, WAV, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Recorded at Cala Jóncols, Catalonia (a Mediterranean cove). Short and has birds; better as a terrace flavour layer than as the main bed. |
| Gulls | Yes | Herring Gull 1.wav | Canardo55 | https://freesound.org/people/Canardo55/sounds/538016/ | CC0 | 0:33, WAV, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Tame herring gull calling from a rooftop (Scheveningen). Close and clean: cut 4 to 6 single calls. Filter and add reverb for mid and distant versions. |
| Gulls | Yes (pair with above) | Herring Gull 2.wav | Canardo55 | https://freesound.org/people/Canardo55/sounds/538015/ | CC0 | 0:20, WAV, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Same bird and setup; 3 to 4 more single calls. |
| Gulls | Alt | Gull.wav | nigelcoop | https://freesound.org/people/nigelcoop/sounds/73497/ | CC0 | 0:03.679, WAV, stereo, 44.1 kHz / 16-bit | Free Freesound account; no payment | Single raucous herring gull call, "no other background noise". One ready-made event. |
| Gulls | Alt (distant) | Gulls at Moelfre.wav | achats57 | https://freesound.org/people/achats57/sounds/372213/ | CC0 | 0:27, WAV, stereo, 44.1 kHz / 16-bit | Free Freesound account; no payment | Herring gulls off an island, naturally distant; cut 2 to 3 far calls. |
| Gulls | Alt | 220_Gaviota.mp3 | byronabadia | https://freesound.org/people/byronabadia/sounds/395472/ | CC BY 4.0 | 0:24, MP3, stereo, 48 kHz | Free Freesound account; no payment | Recorded in Girona, Spain. Page doesn't name the species (it could be yellow-legged gull, but that is unverified), tags also list crows, and it's MP3 only. Attribution: "220_Gaviota.mp3" by byronabadia, https://freesound.org/people/byronabadia/sounds/395472/, CC BY 4.0. |
| House ambience (room tone) | Yes | House Room Tone | aleclubin | https://freesound.org/people/aleclubin/sounds/641306/ | CC0 | 2:03, WAV, stereo, 96 kHz / 24-bit | Free Freesound account; no payment | "Plain room tone of a house (indoors)". Interior bed under everything; loop. |
| House ambience (room tone) | Alt | room tone small space dead quiet air tone.flac | kyles | https://freesound.org/people/kyles/sounds/637807/ | CC0 | 1:55, FLAC, stereo, 48 kHz / 16-bit | Free Freesound account; no payment | Very quiet air tone; fallback if the primary has audible noise. |
| House ambience (fridge) | Yes | Residential kitchen roomtone, refrigerator fridge hum.wav | SpliceSound | https://freesound.org/people/SpliceSound/sounds/338115/ | CC0 | 0:51, WAV, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Quiet home fridge hum inside kitchen tone. Loop as a point source in the kitchen. |
| House ambience (fridge) | Alt | Fridge hum cu hotel OTTAWA 190127.flac | TRP | https://freesound.org/people/TRP/sounds/573932/ | CC0 | 2:08, FLAC, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Close-up hum; longer, so fewer loop seams. |
| Optional: curtain | Yes | 160170_wind blowing curtain_OWI.WAV | CarloVan19 | https://freesound.org/people/CarloVan19/sounds/367328/ | CC0 | 0:08, WAV, stereo, 48 kHz / 16-bit | Free Freesound account; no payment | Cut 2 to 4 flutter events, triggered by gusts at the open panels. |
| Optional: leaves | Yes | Soft Wind in the Trees - Leaves rustle | Borgory | https://freesound.org/people/Borgory/sounds/751473/ | CC0 | 2:26, WAV, stereo, 48 kHz / 24-bit | Free Freesound account; no payment | Page says it was recorded as 2-channel mono (ME66). Plant and terrace rustle layer, driven by wind strength. |
| Optional: footsteps wood floor | Yes | FootstepsonWoodFloor-EDITED.wav | kingsrow | https://freesound.org/people/kingsrow/sounds/362825/ | CC0 | 0:37, WAV, stereo, 44.1 kHz / 16-bit | Free Freesound account; no payment | Dress shoes on wood laminate, noise removed. Cut into a pool of single steps. Hard shoes may feel too formal; check. |
| Optional: footsteps deck | Yes | Footsteps - Wood Deck, Sneakers.WAV | PMarcy | https://freesound.org/people/PMarcy/sounds/399309/ | CC0 | 0:56, WAV, mono, 48 kHz / 24-bit | Free Freesound account; no payment | Individual sneaker steps on a wooden deck, with some creaks. Cut into a terrace step pool. |
| Ocean bed (no-account mirror) | Alt | CFX-20130331-UK-DorsetSeaCliff04 | freesound_community (mirror of Carlvus) | https://pixabay.com/sound-effects/nature-cfx-20130331-uk-dorsetseacliff04-48685/ | Pixabay Content License | 2:31, MP3 | No payment. Page shows a "Free download" button; whether an account is needed was not verified | MP3 mirror of Carlvus take 04 (Freesound CC0 original: https://freesound.org/people/Carlvus/sounds/182603/). Only useful if a Freesound login is a problem; the WAV original is better. |

Gaps and flags
- No verified yellow-legged gull (Larus michahellis) recording under CC0 or CC-BY. Searches for the species name only returned CC-BY-NC material, which is rejected. The gull pool uses herring gull (CC0). The one Spanish CC-BY gull (byronabadia) doesn't name its species.
- Ocean bed: no CC0 file matches the full brief (Mediterranean, rocky, from height, 3+ min, no people). The primary is Mediterranean and 5 min long but recorded at shore level. The cliff-height takes (Carlvus) are English Channel and about 2.5 min each.
- The wind and room-tone pages give little detail (for example, mario1298 has no location or mic notes). Listen for buffeting, hum and noise before adopting.
- Every Freesound pick needs a free Freesound account to download (pages show "Login to download"). No pick needs payment.
- Pixabay: licence verified; whether you need an account to download was not verified.
- Attribution required (CC BY 4.0), only if these alternates are used: juskiddink "waves and seagulls.wav" (149488) and byronabadia "220_Gaviota.mp3" (395472). Credit the title, author, source URL and licence in the in-app credits. All primary picks are CC0, so no attribution is needed. A courtesy credits list is still good practice.
- Sonniss GDC bundles: the archive page (sonniss.com/gameaudiogdc) says royalty-free, commercial use and no attribution, but it forbids AI/ML training. I didn't match any specific pack or file to this brief, so no Sonniss rows are listed.

Preparation (fits the streaming ruling)
- Beds that stream: the ocean bed (breakwater, 5:02) and the wind bed (a gentle breeze, 2:36). Trim to clean start and end points and encode as 48 kHz stereo Opus or AAC at about 96–128 kbps. Each bed plays as two offset streams with random crossfades, so neither file ever audibly restarts. Room tone and fridge hum can stream too, or play as small buffers because they're short and quiet.
- Making the ocean bed sound like it's heard from the terrace: the primary was recorded at shore level. Roll off the highs (a shelf cut of about −4 dB above 4 kHz), soften transients slightly and add a touch of open-air distance. If it still sounds too close, blend in a Carlvus cliff take at low level.
- Short buffers: cut the lapping-on-rocks recording into 6–10 single washes of about 1–4 s, mono, with 20–50 ms fades, positioned at the two rock sources. Cut the gull files into single calls of about 0.5–2 s, mono. Gust swells and the curtain and leaf rustles become 2–6 s mono one-shots.
- Nothing has been listened to yet. The first job at the audio step is a listening pass, where any file with mic wind buffeting, voices, traffic or hum gets swapped for its alternate.

---
SUMMARY: This defines Ghiland's cross-world environmental language, a full Seaside House design spec for Alpha 0.1 (updated with the Master's rulings), and licence-checked sound picks.
WHAT WAS DONE: Wrote palette, light, motion, sound and framing rules; the house layout with dimensions, spawn and reveal; the lighting stack; materials; detail layers; procedural vs GLB split; tier table; ocean and wind design; audio layers; camera numbers; UI-in-world rules; two preview-card directions; and a table of 23 sound assets checked on their pages, with preparation notes.
FILES / SYSTEMS AFFECTED: /workspace/ghiland/docs/phase-a/AURA_WORLDS.md. No code.
IMPORTANT DECISIONS: Corridor-to-glass reveal with the entry starting under Pixel's loading backdrop; late-afternoon default, with the slow sunset as a stretch goal; custom Gerstner ocean with no planar reflections; one onshore wind; lightmaps bake only ambient occlusion and indirect light; AgX with simulated auto-exposure; UI content unlit, frames take a 10–15% tint; raycast fade for occlusion, and glass never occludes; the hero pinAnchor sits over the closed panel at x −6…−4 so a pinned note at 500–550 px per metre doesn't block the view; alpha-to-coverage only on HIGH and ULTRA; all primary sounds are CC0, beds stream, and wave variations are short buffers; no stairs.
RISKS: Real-time sun shadows through a 12 m glass wall on integrated GPUs; plant alpha overdraw near the camera; the ocean bed is shore-level and needs processing to sound like it's heard from height; audio re-sequencing needs careful scheduling.
KNOWN LIMITATIONS: All values are untested starting points. There's no concept art, greybox or measured performance yet. Sounds were chosen from page descriptions without listening. There's no CC0 yellow-legged gull, so the gulls are herring gulls. Freesound downloads need a free account.
RECOMMENDED NEXT ACTION: Master decides who creates or uses a Freesound account to download the picks (it's free, but it needs an account). Forge builds the greybox with only sun, sky, fog, ocean and curtains. The audio step starts with a listening pass over the picks.
