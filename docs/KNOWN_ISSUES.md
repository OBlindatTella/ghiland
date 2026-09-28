# Known issues

Alpha 0.1 steps 0 and 1 only. Items below are expected gaps or deliberate deviations, not regressions to re-file until a later step owns them.

## Not built yet

- No audio, windows, apps, settings, quality tiers, art, ocean shader, or furniture.
- The Ghiland Screen is a placeholder panel. Esc inside it goes straight to RELEASED because there are no inner layers (menus, drags, text fields) yet.
- Landing is one Seaside card. NY Balcony and Golden Hour Farm are preview definitions only and are not on the registry.
- The Seaside card click mounts the canvas. It does not lock the pointer and does not start audio. The first lock is the "Click to walk" click, per Atlas §1.
- Idle breathing, head bob, footsteps, drag-to-look, and the FOV slider are not in this build. There is no jump and no sprint.

## Deviations

- `@react-three/drei`, `framer-motion`, and `@react-three/postprocessing` are approved but not installed. Nothing in steps 0–1 imports them. Drei's pointer-lock helper is not used; lock is owned by `engine/input/pointerLock.ts`.
- `@types/three` is a dev dependency. `three@0.186` no longer ships its own `.d.ts`, and TypeScript strict cannot import it without declarations.
- The root layout mounts `<GhilandApp>` and the route pages render nothing. Next.js treats `history.pushState` to another path as a router restore, which would remount a page-owned canvas. The layout stays mounted, so `/` and `/w/seaside-house` share one canvas.
- The greybox is mounted directly by the canvas. `worlds/registry.ts` and `apps/registry.ts` stay empty until step 2's SceneManager.
- Perf readout is a dev toggle on `` ` `` (`Backquote` → `togglePerfHud`). Pixel's keymap does not assign that action. It shows fps, draw calls, triangles, and shell state. The full PerfProbe (2 Hz store, GPU memory, tier) is step 3.
- No sun shadows. One directional light, a hemisphere light, and exponential fog only.
- Horizontal collision expands AABBs by the capsule radius (axis-aligned padding) and slides one axis at a time. Vertical motion is locked to the floor because there is no jump and every ceiling is above the 1.75 m capsule.
- The reveal fin is a greybox box just inside the living room, offset to the right, so the left side of the corridor stays walkable. It is not Aura's final travertine mesh.

## Browser

- A rejected `requestPointerLock` is not retried. If `{ unadjustedMovement: true }` throws or rejects for a reason other than a denied gesture, the lock helper tries once more without that option.
- Esc while locked is coalesced. Chrome may fire the Escape key and `pointerlockchange` in either order; one press opens SCREEN, and a later Esc leaves SCREEN.
- Firefox's pointer-lock banner, layout-map key labels, and non-Chromium smoke tests are out of scope for this step.
- Back/Forward changes the URL and keeps the session in the world. The canvas is not duplicated.
