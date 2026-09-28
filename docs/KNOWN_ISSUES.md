# Known issues

Alpha 0.1 steps 0–6. Items below are expected gaps or deliberate deviations, not regressions to re-file until a later step owns them.

## Not built yet

- No art, ocean shader, or furniture.
- Carry, pin, and per-world window persistence are step 7. Overlay windows hide in WORLD and stay mounted. The pin button is visible and disabled. A drag that would leave the safe area is clamped; it does not detach. Snap, magnet, and double-click maximize are not built. D-021 (window centre at least 0.7 m from the eye) waits for camera-space placement.
- NY Balcony and Golden Hour Farm are preview cards. A click shows "Alpha 0.2" and does not load a world.
- The Seaside card click unlocks the audio context, starts the beds, and starts loading. It does not lock the pointer. The first lock is "Click to walk".
- Idle breathing, head bob, footsteps, and drag-to-look are not in this build. There is no jump and no sprint.
- Gusts, exposure, and the sunset grade are not driven yet. Zone detection feeds portal occlusion only.

## Deviations

- `@react-three/postprocessing` is installed. `drei` and `framer-motion` are still unused. The loading crossfade uses CSS with Pixel's 1200 ms arrival ease. Drei's pointer-lock helper is not used; lock is owned by `engine/input/pointerLock.ts`.
- Bloom on HIGH and ULTRA is a small threshold pass so the tier table has a post effect. The greybox has no emissive highlights, so it barely shows.
- The loading backdrop uses a flat poster in the greybox palette, not a filmed spawn loop. Card media stays under a few kilobytes. CSS `filter: blur` sharpens that poster only; UI chrome has no backdrop blur.
- If the first frames never stay under 20 ms (software GL), the crossfade still starts after 2.5 s so the arrival cannot stall forever.
- `@types/three` is a dev dependency. `three@0.186` no longer ships its own `.d.ts`, and TypeScript strict cannot import it without declarations.
- The root layout mounts `<GhilandApp>` and the route pages render nothing. Next.js treats `history.pushState` to another path as a router restore, which would remount a page-owned canvas. The layout stays mounted, so `/` and `/w/seaside-house` share one canvas.
- The shelf is Notes, Chat, Web, and Settings. Worlds is not a tile; world switching stays on the landing cards. Settings stays a screen-layer panel, not a window, so Esc still pops that layer. Embed apps have no iframe yet. The Web tile is the external fallback and opens a new tab. Chat replies stay in memory for the page session and are not saved across reload. Notes autosave to IndexedDB (`ghiland` / `kv`), with localStorage only as a fallback under the same size guard.
- Perf readout is a toggle on `` ` `` (`Backquote` → `togglePerfHud`, persisted). Pixel's keymap does not assign that action. The HUD shows fps, frame time, draws, triangles, geometries, textures, heap where the browser exposes it, and long tasks.
- Sea and wind are field recordings (`ocean.ogg`, `wind.ogg`) with a procedural coloured-noise fallback if a file fails to play. Gulls are one CC0 clip. See `docs/AUDIO_CREDITS.md`. Freesound picks were skipped because they need a login. The wind take still has gusts; the loudest ones are limited so the bed stays soft.
- Shadows follow the quality tier (off on LOW, a map on MED and above). The greybox is still one directional light, a hemisphere light, and exponential fog.
- Horizontal collision expands AABBs by the capsule radius (axis-aligned padding) and slides one axis at a time. Vertical motion is locked to the floor because there is no jump and every ceiling is above the 1.75 m capsule.
- The reveal fin is a greybox box flush with the viewer-right wall, outside x −2…+2 once the capsule radius is included (D-020). It is not Aura's final travertine mesh.
- Eye height comes from `WorldDefinition.movement.eyeHeight`, falling back to `MovementSpec`'s 1.62 m. Seaside does not override it, so the eye still matches the spawn.

## Contract gaps left from S1-10

These are the review items that are still different from Atlas. The others in that list are aligned: `pushOwner` / `popOwner` are public, Q / Esc / backtick go through the binding table, `pin` includes the `world` owner, perf HUD visibility lives in settings, and the probe publishes metrics to the store instead of writing the DOM.

- Session store field is `worldId`, not Atlas's `currentWorldId`. `phase` is `landing | loading | inWorld`. `worldPhase` and `loadProgress` are present. There is no `selecting` phase: the card click goes straight from landing to loading. Renaming the id would touch every call site and change nothing the player sees.
- `AppHostApi.emit` is still a no-op `(type: string, payload: unknown)`. Notes and Chat do not emit. A typed app bus can wait until an app needs one.
- `state/input.ts` type-imports `ShellModel` from `engine/input/shellMachine`, and the engine imports `state`. The cycle is types only. Moving the shell model into contracts is a wider edit than this pass.

## Deferred from the steps 0–1 review

- S1-14. Nothing fails the build if `three` is imported onto the landing chunk. The graph still keeps it behind the dynamic canvas import. A size-limit check waits until landing-chunk size is measured in CI.
- S1-15. Collision filtering and the movement loop still allocate each frame. There is no measured cost on the greybox. The obstacle list should be built once per world when furniture arrives.
- S1-16. After a slide is blocked, velocity stays at the wish speed. Footsteps are not in this build, so a wall does not play a step. Reconcile velocity when audio reads displacement.
- S1-17. Radius expansion is a square, the timestep is variable and clamped at 50 ms, and the sweep is X then Z. A step cannot tunnel the glass at that clamp. Rounded corners wait for stools and chairs.
- S1-20. A keyup lost without a window blur (release while a command key is held, some OS shortcuts) can leave that key down. Blur and a hidden tab still clear the set. Not reproduced in this pass.
- D-017 auto-pin. `setBeforeShellChange` runs before the shell store updates. Nothing is installed yet, because carried windows do not exist. Step 7 should pin there when leaving WORLD.
- Test hooks. `window.__ghiland` is on in development, and in production only when the build was started with `NEXT_PUBLIC_GHILAND_TEST_HOOKS=1`. A normal production build has no hook. `getCanvasMounts` counts effect runs, so React Strict Mode in dev can read 2 on the first mount. `setPlayer` is applied on the next frame and zeroes velocity.
- D-021. A window centre must stay at least 0.7 m from the eye, and a placement that cannot is invalid. Overlay windows are screen-space, so this applies when detached and pinned modes exist.

## Browser

- A rejected `requestPointerLock` is not retried. If `{ unadjustedMovement: true }` throws or rejects for a reason other than a denied gesture, the lock helper tries once more without that option. A browser that returns no promise is left pending until `pointerlockchange` or `pointerlockerror`.
- A lock that is still pending when Esc or another gesture leaves that request is cancelled. If the browser grants it anyway, the pointer is released and the shell does not enter WORLD.
- Esc while locked is paired by event order, not a timer. The keydown and the matching unlock count as one press into SCREEN, including when a hitch of 500 ms separates them. Esc pressed while Q's unlock is still in flight is applied after that unlock.
- Firefox's pointer-lock banner, layout-map key labels, and non-Chromium smoke tests are out of scope for this step.
- Back/Forward changes the URL and keeps the session in the world. The canvas is not duplicated.
