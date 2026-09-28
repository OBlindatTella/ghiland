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
