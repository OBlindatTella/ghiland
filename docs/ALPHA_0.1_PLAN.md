# Ghiland Alpha 0.1: Master Plan (synthesis of Phase A)
Owner: Ghiland Master. Sources: phase-a/ATLAS_ARCHITECTURE.md, phase-a/AURA_WORLDS.md, phase-a/PIXEL_UI_SYSTEM.md.
Where this file and a Phase A doc disagree, this file wins.

## The milestone in one sentence
Open Ghiland, choose Seaside House, walk out of a dim corridor into a 12 m glass wall over the sea, hear it, press Q, open Notes, carry it to the glass, pin it, walk away, and feel "Okay. This is different."

## Approved foundations
- Architecture: Atlas's doc as written, with the amendments below. One Next.js app, one persistent R3F canvas, lazy world/app definitions, small Zustand stores, narrow typed event bus, per-frame data in refs only, explicit input owner stack, @react-three/postprocessing as the only new runtime dependency.
- World: Aura's Seaside House as written. Corridor spawn and reveal, late-afternoon default (sun ~12°), Gerstner ocean, one onshore wind driving curtains, plants and audio, AgX with simulated exposure, one sun shadow (off on LOW), baked AO/indirect only, no stairs.
- UI: Pixel's system as written. WORLD / SCREEN / RELEASED states, Q toggles, Esc steps back inside SCREEN, near-opaque surfaces, Atkinson Hyperlegible, no glow/gradients/overshoot, Drag-to-look fallback.

## Conflict resolutions (Master decisions)
1. Screen key is Q (Pixel), not Tab (Atlas placeholder). Tab stays focus navigation.
2. Detached means carrying. A detached window is camera-space and moves with you while you walk. P or the Pin button places it at the crosshair (snapping to wall/table or floating). E on a pinned window (line of sight, ≤ 25 m) picks it up again. Q returns it to the Screen. Atlas's camera-space "detached" contract already fits; Follow mode later is a softer variant of the same handler.
3. Overlay pauses movement. The SCREEN state owns the keyboard. Overlay windows hide when you return to WORLD. Anything you want while walking is carried or pinned.
4. No jump. Shift is "stroll faster" at 2.2 m/s, not a sprint (Aura's numbers). Atlas renames `sprint` to `strollFast` and removes `jump` from the Action union.
5. Window lighting follows Aura. Window content is never lit or exposure-affected. Only the frame takes a 10–15% world tint, capped by Pixel's hue limit. Pixel's "world windows follow exposure within a contrast clamp" is dropped for Alpha.
6. Occlusion. Aura wants pinned windows hidden behind walls; DOM can't be depth-tested, so Atlas's 10 Hz raycast fade is the Alpha solution. Fade to 0 when fully blocked.
7. Typing into pinned windows works natively because windows stay real DOM nodes projected with CSS matrix3d (Atlas decision). No render-to-texture in Alpha.
8. Apps are single-instance in Alpha 0.1.
9. Pinned windows persist per world across sessions. Last player position is not persisted.
10. AI chat stays a mock in Alpha 0.1. Making it real needs a server route, a server-held key and a cost decision from the user.
11. Slow sunset is a stretch goal for Alpha 0.1. It only animates uniforms, so it's cheap, but it ships after the core loop is validated.
12. RELEASED (lock lost) maps to Atlas's `ui` owner with the "Click to walk" hint. Losing lock in WORLD never leaves a broken state.

## Amendments requested
- Atlas: apply 1, 2, 4, 12 to the contracts; add `EnvironmentState` (sun elevation/direction/colour, sky colours, fog, wind, exposure target, tier, audio zone) with slow values in the store and per-frame values in refs/uniforms; add audio zones and portals (interior, terrace, open panels).
- Pixel: none blocking. Keycap hints must read Q/E/P from the keymap table.
- Aura: none blocking. Select and license-check the sound assets before Forge's audio step.

## Build order for Forge (Phase B)
Atlas's 10 steps, with Pixel's request honored: the input state machine is built in step 1 with the greybox, and overlay windows (step 5) come right after audio, before any art polish.
0 Scaffold. 1 Greybox walk + input state machine (WORLD/SCREEN/RELEASED). 2 Worlds, loading, landing, selector. 3 Settings, quality, perf HUD. 4 Audio beds + wind. 5 Ghiland Screen + overlay windows. 6 Notes + AI-chat mock + one external-fallback app. 7 Carry, pin, pick up, occlusion fade, per-world persistence. 8 Seaside art pass (ocean, curtains, reveal lighting), AUTO quality. 9 Sentinel hardening.
Checkpoint after step 1: Sentinel and Master try the walk + Q toggle in greybox before anything else is built on it.

## Definition of done (per feature)
Implemented, interaction works, integrated, tested by Sentinel, major bugs fixed. "Implemented" and "validated" are tracked separately in GHILAND_STATE.md.

## Open for the user
- Where the code lives: an existing GitHub repo or a new one.
- Later: whether the AI chat becomes real.

## Sentinel pre-build conflicts: resolutions (2026-09-28)
13. Pin anchors. Pinning snaps to authored `pinAnchor`s when the crosshair hit is within 1.5 m of one; otherwise it snaps to wall/table or floats facing the player. Glass is never a snap surface. Seaside gets Aura's hero anchor (0.6 m from glass, angled 15° toward the room).
14. Pinned readability. Pinned scale is set so body text renders at 14 px or more on a 1080p screen from 1.75 m. Atlas set 520 px/m (14.8 px at 1.75 m, 62° FOV; ~11.6 px at the 75° FOV max, accepted). Notes pins at about 1.08 × 1.23 m. Sentinel measures it in the step 7 build.
15. Occlusion layers. Glass panels block movement but never occlude windows. Only opaque architecture occludes. Curtains and plants never occlude.
16. Entry flow is Pixel's. One landing page with world cards. Clicking the Seaside card is the gesture that unlocks audio; the sea starts at once under the sharpening loading backdrop and crossfades into the live render. No separate Enter page, no black screen.
17. Foliage anti-aliasing. HIGH/ULTRA use EffectComposer multisampling (4x) so alpha-to-coverage works without a native-antialias canvas. LOW/MED use alpha-test plus SMAA with sparser foliage. Confirmed by Atlas: every tier runs the composer; HIGH/ULTRA drop SMAA; ULTRA DPR cap lowered to 2.0.
18. Audio memory. Long beds (sea, wind, room tone) stream via media elements; only short one-shots and wave variations are decoded into buffers. The 64 MB decoded cap stays.
19. Key hints. Hints always come from the keymap plus `navigator.keyboard.getLayoutMap()`. Where the layout map is missing (Firefox, Safari), hints show the QWERTY label and non-QWERTY layouts are a recorded known limitation until remapping ships.
20. QA gates (defaults, user may override). Chromium desktop gates sign-off. Firefox and Safari get a smoke test and issues are logged but don't block Alpha 0.1. Reference hardware (user override, D-015): dedicated GPU, RTX 3060/3070 class, 60 fps on HIGH gates sign-off; Iris Xe and M1 are informational. Atlas's budget table stands until Sentinel measures.
21. Hero composition. Open glass panels span x 0…+4 (three.js coordinates, D-019: facing +Z, viewer left is +X). The hero pinAnchor `hero-sea` is at about (+5.1, 1.45, 3.9), in front of the closed panel, 0.6 m from the glass and angled 15° toward the room centre (Aura). Notes opens at 440×560 px by default, which pins at about 0.85×1.08 m at 520 px/m (this replaces Atlas's 1.08×1.23 m estimate). Pixel caps the default pinned size at the hero anchor.
22. Sound assets. Aura's CC0 Freesound picks (AURA_WORLDS.md §8) are approved pending a listening pass at the audio step. Downloading needs a free Freesound account: user decision pending. CC-BY alternates require an attribution line in Settings → About.

## Sentinel round 2 rulings (2026-09-28)
23. X-18 Pinned scale is constant: 520 px/m everywhere, and content is never scaled down. Pixel's cap only sets the default pinned size at hero-sea. A window the user resized larger pins at its full physical size.
24. X-19 One window per anchor. An occupied anchor shows as taken in the placement preview, and the next pin falls back to surface or float placement.
25. X-20 On tables, windows stand upright with the bottom edge on the surface, tilted about 10° back, never lying flat. The placement ray stops at any movement collider (glass, balustrade). Hitting glass means a float fallback on the player's side, at least 0.3 m from the glass. Nothing can pin where the player can't walk.
26. X-06 The FOV setting ships: 55–75°, default 62°. Lower readability at high FOV is accepted (D-010 note).
27. X-15 If pointer lock is lost while carrying, the window auto-pins as floating where it is and shows its pin tag. It is never lost or left attached to the camera.
28. X-17 On WebGL context loss, show a calm "Restoring" veil and wait for contextrestored. After 5 s, offer a reload. DOM windows and app state survive because they're DOM. Mute is M in WORLD and a toggle in Settings. UI sounds are soft and short, on by default, with their own "Interface" volume slider. There's no speech in Alpha 0.1, so captions are deferred and recorded as an accessibility item for later rare-event audio.
29. GPU memory budget: HIGH goes to 384 MB (the gating tier is RTX 3060 class). LOW stays at 128 MB with no MSAA.
