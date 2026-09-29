# Known issues

Alpha 0.1 steps 0–8, plus the PR #2 review fixes through S2. Items below are expected gaps or deliberate deviations, not regressions to re-file until a later step owns them.

## Not built yet

- Sailboat, visual gulls, dust motes, grass cards, baked lightmaps, cloud shadows, and the slow sunset are not in this pass. The lighthouse is a small marker, not a sweeping beam. Micro props are a cup and a book. See the step 8 deferrals below.
- Snap, magnet, and double-click maximize are not built. Minimizing a pinned window does not collapse it to an 8 cm pin tag, and the tray does not yet offer Recall / Show. There is no far card past 6 m and no reticle dot. The carry follow is the damped spring; it is not a separate 360 ms tween.
- NY Balcony and Golden Hour Farm are preview cards. A click shows "Alpha 0.2" and does not load a world.
- The Seaside card click unlocks the audio context, starts the beds, and starts loading. It does not lock the pointer. The first lock is "Click to walk".
- Idle breathing, head bob, footsteps, and drag-to-look are not in this build. There is no jump and no sprint.
- Gusts and the sunset grade are not driven yet. Exposure now shifts from about 1.2 in the corridor toward 0.9 facing the glass, damped over 1.5 s. Zone detection still feeds portal occlusion.

## Deviations

- `@react-three/postprocessing` is installed. `drei` and `framer-motion` are still unused. The loading crossfade uses CSS with Pixel's 1200 ms arrival ease. Drei's pointer-lock helper is not used; lock is owned by `engine/input/pointerLock.ts`.
- Bloom on HIGH and ULTRA is a small threshold pass. The sun disk and the water glitter are the highlights it can catch.
- The loading backdrop uses a flat poster in the greybox palette, not a filmed spawn loop. Card media stays under a few kilobytes. CSS `filter: blur` sharpens that poster only; UI chrome has no backdrop blur.
- If the first frames never stay under 20 ms (software GL), the crossfade still starts after 2.5 s so the arrival cannot stall forever.
- `@types/three` is a dev dependency. `three@0.186` no longer ships its own `.d.ts`, and TypeScript strict cannot import it without declarations.
- The root layout mounts `<GhilandApp>` and the route pages render nothing. Next.js treats `history.pushState` to another path as a router restore, which would remount a page-owned canvas. The layout stays mounted, so `/` and `/w/seaside-house` share one canvas.
- The shelf is Notes, Chat, Web, and Settings. Worlds is not a tile; world switching stays on the landing cards. Settings stays a screen-layer panel, not a window, so Esc still pops that layer. Embed apps have no iframe yet. The Web tile is the external fallback and opens a new tab. Chat replies stay in memory for the page session and are not saved across reload. Notes autosave to IndexedDB (`ghiland` / `kv`), with localStorage only as a fallback under the same size guard.
- Perf readout is a toggle on `` ` `` (`Backquote` → `togglePerfHud`, persisted). Pixel's keymap does not assign that action. The HUD shows fps, frame time, draws, triangles, geometries, textures, estimated GPU memory (renderer info plus composer render targets), heap where the browser exposes it, and long tasks.
- Sea and wind are field recordings (`ocean.ogg`, `wind.ogg`) with a procedural coloured-noise fallback if a file fails to play. Gulls are one CC0 clip. See `docs/AUDIO_CREDITS.md`. Freesound picks were skipped because they need a login. The wind take still has gusts; the loudest ones are limited so the bed stays soft.
- Shadows follow the quality tier (off on LOW, a map on MED and above). One directional sun, a hemisphere fill, a room fill that does not reach the corridor, and exponential fog. The corridor is authored dimmer than the glass (about a third, with the existing exposure shift from 1.2 toward 0.9).
- Horizontal collision expands AABBs by the capsule radius (axis-aligned padding) and slides one axis at a time. A diagonal step that would enter a panel's side footprint stays on the outside edge only when the player is within the capsule radius of that panel's corner, so Z can slide past. A panel farther away does not freeze a strafe. Vertical motion is locked to the floor because there is no jump. Floors, ceilings, and the terrace are on the `placement` layer for rays only; they are not movement colliders. The open glass is x −2…+2 (D-025).
- The reveal fin is still a box, now with the travertine tile, flush with the viewer-right wall and outside x −2…+2 once the capsule radius is included (D-020). It is not a modelled stone return.
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
- D-017 auto-pin runs in `setBeforeShellChange`, including context loss. Q returns a carried window to the Screen instead. An auto-pin is never invalid: if the pose is closer than 0.7 m, it still lands (D-017 versus D-021, test plan question 8).
- Test hooks. `window.__ghiland` is on in development, and in production only when the build was started with `NEXT_PUBLIC_GHILAND_TEST_HOOKS=1`. A normal production build has no hook. `getCanvasMounts` counts effect runs, so React Strict Mode in dev can read 2 on the first mount. `setPlayer` and `runCameraPath` are applied on the next frame and zero velocity. `getComposer` reports multisampling, pass names, and whether AgX is the live composer effect. `getAudio` lists each source as `media` or `buffer` and a decoded-byte total. `getGpuMemory` is tracked render-target bytes plus `renderer.info`. `setQuality` writes the settings tier.
- D-021. A window centre must stay at least 0.7 m from the eye, and a placement that cannot is invalid. Overlay windows are screen-space, so this applies when detached and pinned modes exist.

## Browser

- A rejected `requestPointerLock` is not retried. If `{ unadjustedMovement: true }` throws or rejects for a reason other than a denied gesture, the lock helper tries once more without that option. A browser that returns no promise is left pending until `pointerlockchange` or `pointerlockerror`.
- A lock that is still pending when Esc or another gesture leaves that request is cancelled. If the browser grants it anyway, the pointer is released and the shell does not enter WORLD.
- Esc while locked is paired by event order, not a timer. The keydown and the matching unlock count as one press into SCREEN, including when a hitch of 500 ms separates them. Esc pressed while Q's unlock is still in flight is applied after that unlock.
- Firefox's pointer-lock banner, layout-map key labels, and non-Chromium smoke tests are out of scope for this step.
- Back/Forward changes the URL and keeps the session in the world. The canvas is not duplicated.

## Deferred from the PR #2 review

These were not cheap enough to take in this pass, or a ruling already closed them. Spec docs are not edited here (D-026).

- S2-13 / D-024. Alpha accepts losing the fin sliver. The fin stays outside x −2…+2. Do not move it back into the opening.
- S2-20. Procedural bed loops are still re-armed with `setTimeout`. A hidden tab can throttle that timer. Recorded beds use media elements and are the path that plays today.
- S2-21. The look spike clamp can shorten a fast flick. It needs a 1000 Hz mouse to judge. Left as-is.
- S2-24. `viewToWorld` is still tested on its own, not by reading the controller's camera write. Strafe is checked at yaw 0.
- S2-27 residual. The hidden-tab duck is a linear ramp over 400 ms and focus restores it. The media-element crossfade is still a gain target, not an equal-power overlap.
- S2-30. The directional shadow camera now covers the house and terrace (orthographic ±22 m, near 8, far 70, with bias). It is still one map, not cascades.
- S2-31. `WorldHost` still calls `disposeObject3D` in a passive cleanup. R3F has usually detached the children by then, so it is likely a no-op. R3F auto-dispose frees the greybox geometries.
- S2-32. `stepAutoQuality` still returns a new object every frame. Settings still subscribes to the whole store. `setAudioZone` still writes at 10 Hz.
- S2-33. ESLint import boundaries still cover `worlds/` and `apps/` only. The shell deep-imports a few engine modules.
- S2-34 / test-plan drift. The box test plan's RUL-21 and the open-panel sentences still say x −4…0 and an anchor near −5.1. D-025 and plan item 21 win: open panels are x −2…+2, and `hero-sea` stays near (+5.1, 1.45, 3.9) at yaw −165°. This file does not edit the spec.
- S2-35. Settings fields are `master`, `ambient`, and `interface`. There is no drei `PerformanceMonitor`. There is no `gl.compile` of the start tier before reveal.
- S2-18 residual. `cores <= 4` still forces LOW, including a 4-thread CPU with a discrete GPU. Iris Xe now starts LOW. A persisted AUTO ceiling still takes two drops and the 30 s gap, so a weak GPU can sit above LOW for longer than the test plan's 30 s sentence.
- D-021. A deliberate pin closer than 0.7 m shows the invalid ghost and P does nothing. Atlas's older 0.4 m refusal is not a second threshold. Pixel's "scale the window down to fit hero-sea" is not applied; plan item 23 and D-016 keep the full CSS size at 520 px/m.
- Composer disposal does not call `EffectComposer.dispose()`, because that also disposes the shared fullscreen geometry. Passes and render targets are released on rebuild.
- An Esc swallow that never meets its key expires after 2 s, so a 500 ms hitch still counts as one press.
- M toggles mute from the Screen as well as the world, so a slider click does not swallow it.
- Losing the WebGL context shows the Restoring veil and returns the shell to RELEASED. The composer reads `getContextAttributes().alpha`, and a lost context returns null. That read happens in a React layout effect when the post stack rebuilds, not on a frame: the frameloop stays `always`, and the canvas does not re-render for the loss. Passes stay as they are until the context is restored, then the stack builds again. The error boundary does not replace the canvas for that error. Pointer lock is released on the loss and again on the next turn. Automated Chrome has kept `document.pointerLockElement` set even after `exitPointerLock()`; the app still clears its own lock flag.

## Deferred from the step 8 art pass

These are in Aura and were left out so the pass stays inside the draw, triangle, and texture budgets. Spec docs were not edited (D-026).

- No authored GLB and no KTX2/Basis or Draco/meshopt. Surfaces are canvas tiles (512 on LOW, 1024 above) and the lighting map is a PMREM of the sky shader. See `docs/ASSET_CREDITS.md`.
- No baked lightmaps. Interior fill is the hemisphere, the sky PMREM, and two unshadowed point lights. The corridor point is omitted so the corridor stays about a third of the brightness at the glass.
- Ocean mesh is coarser than Aura's 65k-vertex HIGH target (72×42 segments, 5 waves). LOW is 3 waves. No second normal map and no spray particles. Foam is a distance hint in the shader.
- Curtain grids are lighter than Aura's 48×64 ULTRA mesh. Billow is capped at 0.35 m and does not cross the opening. Curtains are not colliders and not occluders.
- Not built: sailboat, visual gulls, dust motes, grass instances, cloud shadows, the slow sunset, and a lighthouse beam. The headland is two distant masses plus a small lamp.
- The floor is honed travertine, including the corridor. Aura's table also lists pale oak planks; the pass follows the art-pass brief (travertine floor and jambs, smoked oak soffit and furniture). The terrace deck is teak.
- Furniture colliders are movement only (desks and tables also pin surfaces). None are occluders, so a pinned note stays visible through the glass. The fig planter blocks movement and does not occlude.
- `renderer.info` draw and triangle totals include the shadow pass on MED and above. The budget check compares that total with Atlas (HIGH 150 draws, 750k triangles, 384 MB). SwiftShader cannot stand in for a 60 fps RTX 3060 measurement.
