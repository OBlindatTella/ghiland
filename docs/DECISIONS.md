# Decision Log

## D-001 Vertical slice first, Seaside House only for Alpha 0.1
Reason: proving the feeling in one world beats three unfinished worlds.
Alternatives: build all three worlds at low fidelity.
Consequences: NY Balcony and Farm appear as preview cards until Alpha 0.2.

## D-002 Apps use three integration strategies (native, embed/API, external browser fallback)
Reason: many sites block iframes; architecture cannot assume embedding.
Alternatives: iframe-everything.
Consequences: app framework needs a capability model per app.

## D-003 One persistent canvas; windows are DOM projected with CSS matrix3d
Reason: keeps text crisp, iframes alive and native pointer/keyboard input; mode switches never remount.
Alternatives: render-to-texture (soft text, no iframes, rebuilt input); Drei Html as-is (reparenting reloads iframes).
Consequences: occlusion is approximate (raycast fade); WebXR later needs a texture path for native apps.

## D-004 Screen key is Q; Esc steps back inside SCREEN
Reason: Tab must remain accessibility focus navigation; Esc is owned by the browser for pointer lock.
Alternatives: Tab, Esc-only.
Consequences: from a focused text field it's Esc then Q, like game chat.

## D-005 Detached = carried in camera space; Pin with P, pick up with E
Reason: one learnable flow that satisfies the success test (carry Notes to the sea view, pin it, walk away).
Alternatives: detached as a free-floating HUD window.
Consequences: Follow mode later reuses the camera-space handler.

## D-006 SCREEN pauses movement; overlay windows hide in WORLD
Reason: "visible cursor = keyboard belongs to the UI" removes WASD-vs-typing conflicts.
Alternatives: walking with overlay open.
Consequences: persistent-while-walking UI is carried or pinned.

## D-007 No jump, no sprint; Shift strolls at 2.2 m/s
Reason: Ghiland is not an FPS; comfort first.

## D-008 Window content is never lit; frames take a 10–15% world tint
Reason: legibility is non-negotiable; tint alone ties windows to the world.
Alternatives: exposure-following content with contrast clamp (Pixel).

## D-009 Alpha 0.1 scope choices
Single-instance apps; pinned windows persist per world; player position not persisted; AI chat is a mock; slow sunset is a stretch goal.

## D-010 Pin anchors, glass never occludes, readable pinned scale
Reason: protects the hero shot and legibility in the success test.
Consequences: worlds author pinAnchors; occlusion uses a separate layer; pinned windows are physically larger (~0.5 m per 250 px).

## D-011 Single-page entry: the world card click unlocks audio
Reason: fewest steps to presence; sound arrives during loading.
Alternatives: separate Enter page (Atlas), sound on black (Aura).

## D-012 Foliage AA via composer multisampling on HIGH+, alpha-test on LOW/MED; audio beds stream
Reason: keeps the permanent antialias:false canvas and the 64 MB audio cap.

## D-013 QA gates: Chromium gates Alpha 0.1; Firefox/Safari smoke-only; reference hardware Iris Xe (LOW 30 fps) and M1 (HIGH 60 fps)
Reason: primary target is modern Chromium desktop; defaults until the user overrides.

## D-014 Hero pin anchor off-axis; Notes default 440×560 px
Reason: a readable pinned Notes (~0.85×1.08 m) centred on the open glass would block the sea; left-third placement keeps horizon and glitter clear.

## D-015 Reference hardware override (user, via Sentinel)
Gating tier: desktop/laptop with a dedicated GPU (RTX 3060/3070 class) at 60 fps on HIGH. Iris Xe (LOW) and M1 are informational: LOW must still degrade gracefully but does not gate Alpha 0.1. Supersedes the hardware part of D-013.

## D-016 Constant pinned scale; one window per anchor; no pinning past movement colliders
Reason: legibility and predictability beat perfect composition; placement must never cross where the player can't walk.

## D-017 FOV setting ships (55–75°); lock loss while carrying auto-pins; context-loss veil; M mutes; UI sounds on with own slider
## D-018 HIGH GPU memory budget raised to 384 MB for the RTX 3060 gating tier; LOW unchanged at 128 MB

## D-019 Coordinate handedness (ruling on Sentinel S1-02)
Aura's visual intent wins: what the viewer sees from the reveal point facing +Z must match AURA_WORLDS.md ("left"/"right" are viewer-relative). Aura's brief used -X as viewer-left, but in three.js (right-handed, Y up) facing +Z the viewer's left is +X. So every X coordinate authored in AURA_WORLDS.md and the plan is negated in code (x -> -x) for Seaside House. From now on, all docs quote three.js world coordinates. Examples: the open glass panels span x 0..+4, and the hero-sea anchor is about (+5.1, 1.45, 3.9). Anchor yaw "15° toward room" means rotated toward the room centre (x=0). RUL-21 and D-014 read with these coordinates.

## D-020 Reveal path stays clear (ruling on Sentinel S1-03)
The straight walk from spawn (0,1.62,-8.2) to the glass must be unobstructed, and the reveal viewpoint V2 (0,1.62,-3) must be walkable. The reveal fin and its collider, with the player radius included, must sit entirely outside the centre band x -2..+2 (flush against a corridor/room side wall), and they must not block the reveal view of the sea through the open panels. GP-5 gates this.

## D-021 Minimum eye distance for placed and carried windows (Sentinel open point, test plan v0.3)
A window centre is never placed closer than 0.7 m from the player's eye. When the glass force-float rule (>=0.3 m on the player's side) can't satisfy that, because the player is standing too close to the glass, the placement is invalid: the ghost shows the invalid state and P does nothing until the player steps back. The carry distance stays at its default.

## D-022 AUTO quality remembers failed tiers (ruling on S2-05)
If a climb to tier T is demoted within 60 s, T becomes the session ceiling and is never retried that session. The persisted value lastAutoTier only records a tier that held for at least 60 s of stable frames. A persisted ceiling (per GPU renderer string) expires after 7 days or on a manual quality change. AUTO then never flaps: at most one failed climb per session.

## D-023 Window front-face convention (ruling on S2-11)
A window quad's front (readable) face is local +Z, the PlaneGeometry default. An anchor or placement rotation turns that +Z normal toward the viewer. A rotation of θ about Y maps the normal to (sin θ, 0, cos θ). hero-sea faces the room (−Z), turned 15° toward the room centre (−X from x=+5.1), so its yaw is ≈ −165°. Unit-test every authored anchor's normal against its intended viewing side.

## D-024 Reveal without a fin screen (ruling on S2-13)
Alpha 0.1 accepts losing the fin 'sliver' reveal. The reveal is carried by the corridor framing: the corridor walls, a lowered soffit/header at the corridor mouth, and the light contrast between the dim corridor and the bright glass. In step 8 Aura may add a screening element only outside the walk band x −2…+2 (for example a low planter or a wall return on the viewer-right). It must not block the straight path or V2.

## D-025 Open panels move to the centre (ruling on S2-12)
Aura's intent was a straight path from the reveal point into open air. After D-019 the opening's edge sat exactly on x=0, the centre line. So the two central panels, x −2…+2, are the open ones. The panels at −6…−2 and +2…+6 are closed. hero-sea stays at about (+5.1, 1.45, 3.9) in front of the closed +4…+6 panel. The terrace walk from V2 goes straight out with no seam. Collision along panel edges must slide without snagging.

## D-026 Docs source of truth
The box copies in /workspace/ghiland/docs are canonical for specs, owned by Ghiland Master. Each builder run gets the updated box files and overwrites the repo docs/ copies with them. The builder does not edit spec docs itself; it only edits KNOWN_ISSUES.md, ROADMAP.md, AUDIO_CREDITS.md and README content, and it proposes spec changes in its report.

## D-027 Seaside composition update accepted (Aura, after D-024/D-025)
- Sun: azimuth 22° from +Z toward −X, elevation 12°. The unit vector is about (−0.367, 0.208, 0.907).
- Curtains: gathered at the opening edges, never across it. They are 0.8 m wide on a ceiling track at z 4.3, the left one at x +1.8…+2.6 and the right one at x −2.6…−1.8, with a 0.35 m maximum billow.
- Corridor-mouth soffit: smoked oak across x −1.1…+1.1 and z −4.4…−3.5, with its underside at 2.10 m.
- Corridor lighting: about a third of the room's brightness, with an exposure shift from about 1.2 to 0.9.
- Step-8 screen: a fiddle-leaf fig planter at about (−2.9, 0, −2.6).

The details are in AURA_WORLDS.md, which is canonical. The sun, soffit and curtain positions go into the greybox with the step-7 run, and materials and cloth come with step 8.

## D-028 Severity rulings for the PR #3 review
S3-02 (context loss throws in addPass and the canvas can't be restored) and S3-04 (two tabs overwriting each other's Notes) are BLOCKERs for Alpha 0.1 sign-off. Alpha 0.1 can't be called complete until both are fixed and pass at runtime. S3-01 (the opening-edge rail) is a golden-path BLOCKER and must be fixed before step 7 merges.

## D-029 Notes storage policy (S3-03/S3-04/S3-05/S3-06)
- Notes are stored per-note in IndexedDB (one record per note, carrying a version field and updatedAt), never as the whole array.
- Each note may hold up to 2,000,000 characters. A calm inline warning appears at 80% of that; past the limit, only the extra text is refused, never the whole save.
- Single writer across tabs: a Web Lock or BroadcastChannel leader election. Other tabs show a calm "Ghiland is open in another tab" state with a "Use here" button that takes over the lock, and they are read-only until then.
- Writes are flushed on pagehide and visibilitychange=hidden, and before the veil's Reload.
- A corrupt record or a failed read is quarantined to a backup key and is never overwritten.

## D-030 Shell and key rulings (S3-12, S3-17, S3-19)
- S3-12: A blur caused by our own window.open (within 500 ms) keeps the shell in SCREEN, and the card stays visible on return.
- S3-17: M mutes in SCREEN too, unless a text field has focus. This is an accepted deviation from DES-23.
- S3-19:
  - Add per-app last position (SCR-08), role=region on windows (A11Y-08), and a close fade of 120 ms or less (no overshoot).
  - Snap (WIN-03), F6 region cycling and a Worlds tile are deferred to Alpha 0.2.

## D-031 AUTO oscillation bound (S3-16)
After the first 60 s, AUTO makes at most 2 tier changes per rolling 5 minutes, unless a demotion is needed because fps stays below 50% of target for 3 s. A ceiling resets only after 7 days, on a manual change, or on a GPU string change.

## D-032 Three ray-blocker sets (Sentinel step-7 risk 2/3)
- Placement ray: movement plus placement colliders.
- Occlusion fade ray: the occluder layer only. Glass, curtains and plants are never occluders.
- Crosshair/pick-up ray: walls/occluders plus window quads, capped at 25 m.
- The D-027 soffit and curtains are neither occluders nor movement colliders, and curtains aren't pin surfaces.
- Anchor occupancy is derived from open windows.
- The D-021 preview and the pin use the same placement result.
- migrateWindows goes through the guarded persist writer and never silently drops pinned windows.
