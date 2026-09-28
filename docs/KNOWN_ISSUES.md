# Known issues

Alpha 0.1 steps 0–2. Items below are expected gaps or deliberate deviations, not regressions to re-file until a later step owns them.

## Not built yet

- No settings, quality tiers, perf budgets, art, ocean shader, or furniture. Audio is unlocked on the Seaside click; the buses and beds are step 4.
- No app windows. The Screen is a 12% scrim and an empty launcher shelf. Esc pops launcher focus (press `/`), then RELEASED. Menus, drags, and text fields are on the same stack and unused until those layers exist.
- NY Balcony and Golden Hour Farm are preview cards. A click shows "Alpha 0.2" and does not load a world.
- The Seaside card click unlocks the audio context and starts loading. It does not lock the pointer. The first lock is "Click to walk".
- Idle breathing, head bob, footsteps, drag-to-look, and the FOV slider are not in this build. There is no jump and no sprint.

## Deviations

- `@react-three/drei`, `framer-motion`, and `@react-three/postprocessing` are approved but not installed yet. The loading crossfade uses CSS with Pixel's 1200 ms arrival ease. Drei's pointer-lock helper is not used; lock is owned by `engine/input/pointerLock.ts`.
- The loading backdrop uses a flat poster in the greybox palette, not a filmed spawn loop. Card media stays under a few kilobytes. CSS `filter: blur` sharpens that poster only; UI chrome has no backdrop blur.
- If the first frames never stay under 20 ms (software GL), the crossfade still starts after 2.5 s so the arrival cannot stall forever.
- `@types/three` is a dev dependency. `three@0.186` no longer ships its own `.d.ts`, and TypeScript strict cannot import it without declarations.
- The root layout mounts `<GhilandApp>` and the route pages render nothing. Next.js treats `history.pushState` to another path as a router restore, which would remount a page-owned canvas. The layout stays mounted, so `/` and `/w/seaside-house` share one canvas.
- `apps/registry.ts` stays empty. Seaside is registered and loaded by SceneManager. The app registry waits for step 6.
- Perf readout is a dev toggle on `` ` `` (`Backquote` → `togglePerfHud`). Pixel's keymap does not assign that action. It shows fps, draw calls, triangles, and shell state. The full PerfProbe (2 Hz store, GPU memory, tier) is step 3.
- No sun shadows. One directional light, a hemisphere light, and exponential fog only.
- Horizontal collision expands AABBs by the capsule radius (axis-aligned padding) and slides one axis at a time. Vertical motion is locked to the floor because there is no jump and every ceiling is above the 1.75 m capsule.
- The reveal fin is a greybox box just inside the living room, offset to the right, so the left side of the corridor stays walkable. It is not Aura's final travertine mesh.

## Browser

- A rejected `requestPointerLock` is not retried. If `{ unadjustedMovement: true }` throws or rejects for a reason other than a denied gesture, the lock helper tries once more without that option.
- Esc while locked is coalesced. Chrome may fire the Escape key and `pointerlockchange` in either order; one press opens SCREEN, and a later Esc leaves SCREEN.
- Firefox's pointer-lock banner, layout-map key labels, and non-Chromium smoke tests are out of scope for this step.
- Back/Forward changes the URL and keeps the session in the world. The canvas is not duplicated.
