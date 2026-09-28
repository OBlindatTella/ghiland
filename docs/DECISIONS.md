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
