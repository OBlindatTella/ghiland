# Ghiland Alpha 0.1: Architecture (Atlas, Phase A)

Status: **approved** by Ghiland Master, amended per `docs/ALPHA_0.1_PLAN.md` and `docs/DECISIONS.md` D-003 to D-018, including Plan items 13–20 and 23–29 (those files win on conflict). Forge builds from these contracts.
Scope: one playable world (Seaside House), shell + windows + 2 apps, settings, persistence, perf.
Design test: *will this still make sense with 20 worlds, 50 apps, more screen modes, multiplayer and WebXR?* And: *can a new contributor understand it in an afternoon?*

Remaining assumptions that depend on Pixel or Aura are marked **[ASSUMPTION: Pixel]** / **[ASSUMPTION: Aura]**.

---

## 0. Five rules the whole codebase follows

1. **One persistent canvas.** The R3F `<Canvas>` mounts once in the experience layout and never remounts on world change. Worlds load into it and unload out of it.
2. **Manifests + lazy loaders.** Every world and app is a small definition object with `load: () => import(...)`. Registries import only definitions, so bundle size stays flat as worlds/apps grow.
3. **Per-frame data never goes through React.** Player transform, camera, key state, window projection matrices and perf samples live in refs or are read with `store.getState()` inside `useFrame`. Zustand holds *decisions*, not *frames*.
4. **Worlds and apps never import each other.** They import only `contracts/`, `ui/`, and the public `engine/index.ts` API. Enforced with ESLint `no-restricted-imports` (built-in, no dependency).
5. **State answers "what is"; events answer "what just happened".** (See section 5.)

---

## 1. Repo / folder structure

Single Next.js App Router app, pnpm, TypeScript strict. No monorepo until there is a second deployable.

```
ghiland/
  docs/                      # phase docs, ADRs
  public/
    worlds/seaside-house/    # compressed .glb, .ktx2, audio (.ogg + .m4a)
    decoders/basis/          # KTX2 transcoder (served statically)
  scripts/
    compress-assets.ts       # gltf-transform: meshopt + KTX2
  src/
    app/
      layout.tsx             # html, fonts, global css. NO three.js here
      page.tsx               # <GhilandApp/>: landing + world cards + loading + world, ONE page (Pixel §4)
      w/[worldId]/page.tsx   # deep link: same <GhilandApp initialWorldId/>, card pre-selected
    engine/                  # runtime systems; public surface = engine/index.ts
      canvas/                # Experience.tsx (client-only, dynamic ssr:false), CanvasRoot.tsx (gl setup, frameloop)
      scene/                 # SceneManager.tsx, lifecycle.ts, dispose.ts
      player/                # FirstPersonController.tsx, collision.ts, playerRef.ts
      environment/           # EnvironmentDirector.tsx (sun, gusts, zones, exposure), uniforms.ts, zones.ts
      input/                 # InputManager.ts, bindings.ts, pointerLock.ts
      audio/                 # AudioEngine.ts, buses.ts, ambience.ts, emitters.ts, zones.ts
      quality/               # profiles.ts, applyQuality.tsx, autoQuality.tsx
      perf/                  # PerfProbe.tsx (in-canvas sampler), PerfHud.tsx
      events/                # bus.ts (~25 lines)
      index.ts
    shell/                   # the "OS" layer. Pixel owns look + interaction, Atlas owns structure
      screen/                # GhilandScreen.tsx (summoned by one key)
      launcher/              # Launcher.tsx
      windows/
        WindowLayer.tsx      # DOM layers: pinned (under) + screen-space (over)
        WindowFrame.tsx      # chrome: drag/resize/close/minimize
        projector.ts         # computes CSS matrix3d per frame for world-space windows
        modes/               # overlay.ts, detached.ts, worldPinned.ts, index.ts (mode registry)
      loading/               # LoadingScreen.tsx
    worlds/
      registry.ts            # the ONLY file that lists all worlds
      seaside-house/         # definition.ts, Scene.tsx, collision.ts, audio.ts, assets.ts
      ny-balcony/definition.ts   # status: 'preview' (no scene yet)
      farm/definition.ts         # status: 'preview'
    apps/
      registry.ts            # the ONLY file that lists all apps
      host/                  # AppHost.tsx, EmbedFrame.tsx, ExternalCard.tsx, hostApi.ts
      notes/                 # definition.ts, NotesApp.tsx, store.ts
      ai-chat/               # definition.ts, AiChatApp.tsx, mockResponder.ts
      settings/              # settings is itself an app (Pixel's shelf: Notes, Chat, Worlds, Settings)
    state/                   # session.ts, windows.ts, input.ts, settings.ts, perf.ts, environment.ts, persist.ts
    contracts/               # world.ts, app.ts, window.ts, input.ts, environment.ts, audio.ts, quality.ts, events.ts, math.ts
    ui/                      # shared primitives (Button, Slider, Toggle, Panel)
    lib/                     # small pure utils
```

**Entry is a single page (Master ruling, Plan items 13–20; Pixel §4).** Landing, world cards, loading and the world are phases of one `<GhilandApp/>`, with no route change in between. Clicking the Seaside card is the gesture that unlocks Web Audio, and the sea fades in immediately. There is no separate "Enter" page. The first pointer lock is taken by the "Click to walk" click once the world is live, because the card click's activation expires during loading.
- The canvas (`<Experience/>`) mounts on the first card click and then stays mounted for the rest of the session, so world switches never lose the WebGL context.
- First paint stays DOM-only: three.js isn't in the landing bundle. The engine chunk is prefetched once the page is idle and on card hover.
- The URL follows the world with `history.pushState` to `/w/<id>` (Next App Router syncs with it, no navigation, no remount). Opening `/w/<id>` directly renders the same page with that card pre-selected. It still needs the one click for audio.

---

## 2. Core TypeScript contracts

### 2.1 Shared math

```ts
// contracts/math.ts
export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export interface AABB { min: Vec3; max: Vec3 }
export interface ScreenRect { x: number; y: number; w: number; h: number } // CSS px, viewport-relative
```
Plain tuples, not `THREE.Vector3`: serializable (persistence, multiplayer), no three import in contracts.

### 2.2 Worlds

```ts
// contracts/world.ts
export type WorldStatus = 'playable' | 'preview';

export interface WorldDefinition {
  id: string;                    // 'seaside-house', also the URL slug
  version: number;               // bump when pinned-window anchors / saved data change meaning
  title: string;
  tagline?: string;
  status: WorldStatus;           // 'preview' = selector card only, no load()
  thumbnail: string;
  load?: () => Promise<{ default: WorldModule }>;  // required when playable
  spawn: { position: Vec3; yaw: number; pitch?: number };
  collision: CollisionSpec;
  environment: EnvironmentPreset;  // section 2.6: default sun, sky, fog, wind
  zones: WorldZone[];            // section 2.6: shared by exposure and audio
  portals?: AcousticPortal[];    // section 2.6: openings between zones (open glass panels)
  audio?: WorldAudioSpec;        // section 7
  movement?: Partial<MovementSpec>; // overrides engine defaults (section 2.5)
  pinAnchors?: PinAnchor[];      // suggested spots for world-pinned windows [ASSUMPTION: Aura/Pixel]
  quality?: Partial<Record<QualityTier, Partial<QualityProfile>>>; // per-world overrides
  budget?: Partial<PerfBudget>;  // section 6
  // future: maxPlayers?, xr?: { supported: boolean }, portals?: PortalDefinition[]
}

export interface WorldModule {
  Scene: React.ComponentType<WorldSceneProps>;
  preload?: () => Promise<void>;  // warm GLTF/texture/audio caches during loading screen
  dispose?: () => void;           // world-specific cleanup beyond automatic disposal
}

export interface WorldSceneProps {
  quality: QualityProfile;
  onReady: () => void;            // world signals "first frame is presentable" (ends loading screen)
}

export type CollisionSpec =
  | { kind: 'boxes'; walkable: AABB; colliders: Collider[]; floorY: number } // Alpha
  | { kind: 'mesh'; url: string };                                           // future: BVH, same layers

// Layers decouple "blocks you" from "hides windows" from "you can pin to it" (Plan items 13–20).
export type ColliderLayer = 'movement' | 'occluder' | 'pinSurface';
export interface Collider { id: string; box: AABB; layers: ColliderLayer[] }
// Seaside examples:
//   walls, travertine fin       ['movement', 'occluder', 'pinSurface']
//   tables, desk, kitchen island ['movement', 'pinSurface']
//   sofa, chairs, beds           ['movement']
//   glass wall, glass balustrade ['movement']            glass never occludes and is never a pin surface
//   curtains, plants             not colliders at all    never block, occlude or take pins

export interface PinAnchor {
  id: string; position: Vec3; quaternion: Quat; label?: string;
  defaultSize?: { w: number; h: number };   // CSS px a window takes when pinned here unless the user resized it larger (Pixel's hero-sea cap)
}
// One window per anchor (D-016). Occupancy is derived, never stored on the anchor:
//   isAnchorOccupied(worldId, anchorId) = some worldPinned window in that world has that anchorId
// Seaside: Aura's hero spot is authored as an anchor ('hero-sea': 0.6 m from the glass, turned 15° toward the room)
// [ASSUMPTION: Aura supplies the exact anchor transforms]

export type WorldPhase =
  | 'idle' | 'loading' | 'ready' | 'entering' | 'active' | 'exiting';
```

**Registry + lifecycle**

```ts
// worlds/registry.ts
export const worlds: readonly WorldDefinition[] = [seasideHouse, nyBalcony, farm];
export const getWorld = (id: string) => worlds.find(w => w.id === id);
```

`SceneManager` (engine/scene) owns the lifecycle:

1. `requestWorld(id)` in session store → phase `loading`.
2. `await def.load()` then `await module.preload?.()`; progress from Drei `useProgress` + audio decode progress, merged into one number.
3. Mount `<module.Scene>` inside its own `<Suspense>`; phase `ready` on `onReady()`.
4. `entering`: camera placed at spawn, loading screen fades out (Framer Motion), ambience fades in. Then `active`: input owner goes to `world`.
5. Leaving: `exiting` (fade to loading screen, ambience fades out), unmount Scene, then `dispose()`: traverse and dispose geometries/materials/textures, `useGLTF.clear(urls)`, release audio buffers not in the shared cache.

Only one world is mounted at a time in Alpha. The phases are a plain union so portals/preloading adjacent worlds can be added later without changing callers.

### 2.3 Apps

```ts
// contracts/app.ts
export type AppIntegration =
  | { kind: 'native'; load: () => Promise<{ default: React.ComponentType<AppProps> }> }
  | { kind: 'embed'; url: string; sandbox: string; allow?: string; fallback: 'external' | 'none' }
  | { kind: 'external'; url: string };           // opens a new tab; window shows a card

export interface AppCapabilities {
  textInput: boolean;       // needs keyboard focus -> input owner 'text' while focused
  audio?: boolean;          // plays sound -> routed through the 'app' bus (native only)
  network?: boolean;
  storage?: 'local' | 'none';
  xrSafe?: boolean;         // can render without DOM (future WebXR texture surface)
}

export interface AppWindowSpec {
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  resizable: boolean;
  singleton: boolean;                   // always true in Alpha 0.1 (D-009); field kept for later
  allowedModes: WindowModeKind[];       // e.g. external apps may not be pinnable
}

export interface AppDefinition {
  id: string;               // 'notes'
  version: number;
  title: string;
  icon: string;
  category: 'productivity' | 'social' | 'media' | 'system' | 'fun';
  integration: AppIntegration;
  capabilities: AppCapabilities;
  window: AppWindowSpec;
}

export interface AppProps { windowId: string; host: AppHostApi }

export interface AppHostApi {
  setTitle(title: string): void;
  close(): void;
  requestFocus(): void;
  storage: NamespacedStorage;           // localStorage under ghiland:app:<appId>:*
  emit: EventBus['emit'];               // limited to app-scoped events
}
```

**Integration strategy.** Native apps are React components (Notes, AI-chat mock, Settings). Embed apps run in a sandboxed iframe. Many sites refuse framing (`X-Frame-Options` / CSP `frame-ancestors`) and a cross-origin page can't be probed reliably from the client, so embeds must be **curated** (known-frameable URLs in the definition), with an `onload` timeout that swaps to the external card when the frame stays blank. External apps open a new tab and the window shows a card with the app's icon and an "Open" button. Alpha ships native only (the AI chat stays a mock, D-009), plus one test app proving the external fallback path.

App-private data never enters a central store: each app owns a namespaced store (Notes: `ghiland:app:notes`, own schema version). 50 apps never touch one shared schema.

### 2.4 Windows

```ts
// contracts/window.ts
export type WindowModeKind = 'overlay' | 'detached' | 'worldPinned'; // future: 'follow' | 'focus' | 'ambient'

export type WindowMode =
  | { kind: 'overlay'; rect: ScreenRect }        // inside SCREEN only; hidden (not closed) in WORLD (D-006)
  | {
      kind: 'detached';                          // carried: camera-anchored, moves with you while you walk (D-005)
      offset: Vec3;                              // camera-local, default [0, 0, -1.1] (held ~1.1 m ahead)
      lagMs: number;                             // soft follow lag, default 150
    }
  | {
      kind: 'worldPinned';
      worldId: string;                           // hidden (not closed) in other worlds
      position: Vec3; quaternion: Quat;
      pxPerMeter: 520;                           // constant (D-016): 1 px ≈ 1.92 mm, never scaled down; see "Pinned scale"
      anchorId?: string;                         // set when snapped to an anchor; that anchor is then occupied
      placement: 'anchor' | 'surface' | 'float'; // which step of the placement rule produced it (drives the pin tag + tests)
    };

export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface WindowInstance {
  id: string;                // crypto.randomUUID()
  appId: string;
  title: string;
  mode: WindowMode;
  lastScreenRect: ScreenRect;  // overlay restore target; its w/h is the window size in every mode
  state: WindowState;        // a minimized pinned window collapses in place to a pin tag (Pixel)
  z: number;                 // order within its layer
  owner: 'local';            // reserved for multiplayer (shared windows later)
  createdAt: number;
}

// shell/windows/modes/index.ts: one handler per mode kind; adding a mode = one file + registry entry
export interface WindowModeHandler<K extends WindowModeKind = WindowModeKind> {
  kind: K;
  space: 'screen' | 'camera' | 'world';             // overlay | detached (and future follow) | pinned
  inputPolicy: 'ui' | 'world' | 'world-until-focused'; // overlay: ui; detached: world (you keep walking); pinned: world until clicked
  // camera- and world-space modes return a CSS matrix3d each frame; screen-space return null (plain CSS)
  project?(mode: Extract<WindowMode, { kind: K }>, ctx: ProjectionContext): string | null;
}
```

**Mode transitions (Alpha 0.1, D-005):**

| From | Trigger | To |
|---|---|---|
| overlay | Pin button or `P` | worldPinned at the crosshair, via the placement rule below |
| overlay | drag title bar off the Screen edge, hold 300 ms | detached (Screen closes, pointer locks) |
| detached | `P` | worldPinned at the crosshair, via the placement rule below (Pixel's `E` put-down maps here too) |
| detached | `Q` | overlay |
| worldPinned | look + `E` (line of sight, ≤ 25 m) | detached (flies to you, 360 ms) |
| worldPinned | "return to Screen" button, or Recall in the tray | overlay |
| detached | pointer lock lost (Escape, blur, tab hidden) | worldPinned **as float, where it is now**, pin tag shown (D-017). Never lost, never left on the camera |

**Placement rule (Plan items 13–20, amended by D-016).** One pure function, `resolvePlacement(ray, world, windows) -> Placement`, used by both the carry preview and the actual pin, so the preview always matches the landing spot.

Raycast from the crosshair up to 3 m against **all `movement` colliders** (including glass and balustrades). The ray stops at the first movement collider it hits. It never passes through one, so nothing can pin where the player can't walk.
1. **Anchor.** If an authored `PinAnchor` is within 1.5 m of the hit point (or of the float point when nothing is hit) and is **not occupied**, snap to that anchor's exact transform. An occupied anchor is skipped and shown as taken in the preview (one window per anchor), and the rule falls through to step 2.
2. **Surface.** Otherwise, if the first hit collider has the `pinSurface` layer, place against it:
   - vertical face (wall, fin): flat against the face, offset 5 mm along its normal;
   - horizontal top face (table, desk, island): **upright, bottom edge on the surface, tilted 10° back** (away from the player), yaw facing the player's horizontal position. Never lying flat.
3. **Float.** Otherwise float upright, facing the player, at 1.6 m ahead, or nearer if a movement collider was hit first.
   - If the first hit was a non-`pinSurface` movement collider (glass, balustrade, sofa), float on the **player's side** of the hit: distance \(\min(1.6,\ d_{hit} - 0.3)\) m, so the window is always at least 0.3 m in front of the glass.
   - If that leaves less than 0.4 m between the window and the camera, the pin is refused (preview goes red, soft "no" cue) instead of placing a window in your face.

Glass is never a pin surface, so pinning toward the sea never lays a window on the glass.

**Pinned scale (Plan items 13–20, D-016): a constant 520 px per metre, everywhere.** Content is never scaled down to fit a spot. A window's pinned physical size is its CSS size ÷ 520. When pinning to an anchor with `defaultSize`, the window takes that size unless the user already resized it larger, in which case it pins at its full size. Requirement: body text at least 14 px on a 1080p screen from 1.75 m.
- Aura's default vertical FOV is 62°. At distance \(d\), one world metre spans \(\frac{540}{d \cdot \tan 31°}\) screen pixels at 1080p. At 1.75 m that's \(540 / (1.75 \times 0.6009) \approx 513.5\) px.
- Notes body text is 15 CSS px, so its on-screen size is \(15 \times 513.5 / \text{pxPerMeter}\). For at least 14 px, pxPerMeter must be ≤ \(15 \times 513.5 / 14 \approx 550\).
- 520 leaves about 5% margin: body text renders at 14.8 px at 1.75 m, 17.3 px at 1.5 m and 13.0 px at 2 m.
- Consequence: pinned windows are physically larger than the earlier 909 px/m value. Notes (560 × 640 px) pins at about 1.08 × 1.23 m, Chat (440 × 620) at 0.85 × 1.19 m. Aura's hero anchor needs that much clear space, and it still has to leave the sea visible.
- Consequence: the window's physical size is fixed. Raising the FOV setting (55–75°, D-017) to its 75° maximum shrinks text to about 11.6 px at 1.75 m. That's accepted (D-010 note), because world scale shouldn't change with FOV. At 55° it's about 17.1 px.
- Crispness: closer than about 1.73 m the matrix scales content above 1:1. With no `will-change`, Chromium re-rasterizes at the final scale, so it stays sharp (WIN-19 verifies). Fallback if it blurs: lay the pinned element out at 2× and scale it down by 0.5 in the matrix.

Beyond 6 m a pinned window renders as Pixel's far card (content paused). A future `follow` mode is the detached handler with smarter repositioning; `focus` and `ambient` fit the same shape. Adding one is a union member plus a handler file, no changes elsewhere.

### 2.5 Input ownership

```ts
// contracts/input.ts
export type InputOwner =
  | 'world'   // pointer locked: mouse looks, movement keys move
  | 'ui'      // pointer free, cursor visible, movement off, global hotkeys on
  | 'text'    // a text field has focus: every key goes to it except Escape
  | 'system'; // loading / transitions: everything off except Escape

export type Action =
  | 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight' | 'strollFast'
  | 'toggleScreen' | 'interact' | 'pin' | 'toggleMute' | 'togglePerfHud' | 'escape';

export interface KeyBinding { action: Action; codes: string[]; owners: InputOwner[] } // KeyboardEvent.code

// Pixel's shell states. The owner decides where keys go; the shell state decides what's drawn.
export type ShellState = 'WORLD' | 'SCREEN' | 'RELEASED';
//   WORLD    -> owner 'world'  (pointer locked)
//   SCREEN   -> owner 'ui', or 'text' while a field has focus (movement paused, D-006)
//   RELEASED -> owner 'ui' + "Click to walk" hint; world keeps running, ambience ducks

export interface MovementSpec {   // engine defaults from Aura §5
  walkSpeed: number;              // 1.35 m/s
  strollFastSpeed: number;        // 2.2 m/s while Shift held. Not a sprint; no jump (D-007)
  backMultiplier: number;         // 0.8
  strafeMultiplier: number;       // 0.85
  eyeHeight: number;              // 1.62 m
  capsule: { height: number; radius: number }; // 1.75 m, 0.3 m
}
```

- **Owner stack, not a flag.** `pushOwner(owner) -> token`, `popOwner(token)`. Nested things (text field inside a window inside the Screen) restore correctly when they close.
- **Bind by `KeyboardEvent.code`**, not `key`: layout-independent (Italian/AZERTY keyboards get physical WASD). Bindings are rebindable and persisted.
- **Actions, not keys, reach gameplay.** The controller asks `isActionDown('moveForward')`, never "is W down". WebXR controllers and gamepads later map to the same actions.
- **Pointer lock is owned by the browser.** Escape always releases it and can't be intercepted, and re-locking needs a user gesture (Chrome adds a short cooldown). So `pointerlockchange` is the source of truth. Lock lost by Escape in WORLD goes to SCREEN (same as `Q`). Lock lost by blur or tab hidden goes to RELEASED. If a window is being carried when lock is lost (any cause), it is auto-pinned as float at its current world transform before the shell state changes (D-017). A rejected re-lock stays where it is with "Click to walk", no retry loop. Never a broken state.
- Key state lives in a `Set<string>` ref, read inside `useFrame`. No React state.
- **Keys (D-004, D-005):** `Q` toggles the Screen (and returns a carried window to it), `E` interacts / picks up a pinned window, `P` pins, `M` mutes / unmutes (WORLD; also a toggle in Settings, D-017), `Shift` strolls faster. `Tab` stays accessibility focus navigation. `Esc` steps back one layer inside SCREEN and never re-locks. Keycap hints read from the binding table.

### 2.6 Environment, zones and portals

One contract shared by every world (Aura's "one wind, one sun" rules). **Slow values** live in the `environment` store and change at most a few times a second or on events. **Per-frame values** live in one shared uniforms object and refs, never in React state.

```ts
// contracts/environment.ts
export interface EnvironmentState {              // store (slow)
  sun: {
    elevationDeg: number;                        // Seaside default ~12
    azimuthDeg: number;
    direction: Vec3;                             // derived from elevation + azimuth
    color: string;                               // hex, e.g. '#FFC98F' (~3800 K)
    intensity: number;
  };
  sky: { zenith: string; horizon: string; sunGlow: string };
  fog: { color: string; density: number };       // color defaults to sky.horizon
  wind: {
    direction: Vec3;                             // unit vector on XZ (Seaside: onshore)
    strength: number;                            // 0..1 base
    gust: GustEvent | null;                      // the gust currently travelling, if any
    frontSpeed: number;                          // m/s a gust front travels (~6)
    seed: number;                                // turbulence noise seed
  };
  exposure: { zoneTarget: number };              // from the current zone; view-facing bias is per-frame
  tier: QualityTier;                             // read-only mirror, written only by the quality system
  audioZone: string;                             // id of the zone the player is in
}

export interface GustEvent {                     // stored once per gust (every 15–45 s), not per frame
  startedAt: number;                             // seconds on the environment clock
  amplitude: number;                             // 0.3–0.7
  riseS: number; holdS: number; fallS: number;   // ~1.5 / 2–4 / ~3
}
// Every consumer evaluates sampleGust(gust, t - distanceAlongWind / frontSpeed) itself,
// which is what makes a gust visibly travel: grasses first, curtains ~1 s later.

export type EnvironmentPreset = Omit<EnvironmentState, 'tier' | 'audioZone' | 'exposure'>;

export interface WorldZone {
  id: string;                                    // Seaside: 'corridor' | 'interior' | 'terrace'
  bounds: AABB[];
  kind: 'interior' | 'exterior';
  exposureTarget: number;                        // Aura: ~1.2 corridor ... ~0.9 facing the sun
  roomToneGain?: number;                         // interiors are never silent
}

export interface AcousticPortal {                // an opening sound (and light) comes through
  id: string;                                    // Seaside: the two open lounge-side glass panels
  between: [zoneId: string, zoneId: string];     // 'interior' <-> 'terrace'
  bounds: AABB;
  open: boolean;
}
```

**Who writes what.**
- `EnvironmentDirector` (engine/environment) seeds the store from the world's `EnvironmentPreset`, schedules gusts, detects the player's zone at 10 Hz, and later runs the slow sunset (stretch goal: it only moves `sun.elevationDeg`, and sky, fog and lamps follow).
- Per frame it writes the shared uniforms object (`uTime`, `uWindDir`, `uWindStrength`, the current gust, `uSunDir`, `uSunColor`, fog, `uExposure`). Every material gets the same uniform objects by reference, so one `.value` write updates all of them without React.
- Exposure: the per-frame target is `zoneTarget` biased by how much the view faces the glass, damped over ~1.5 s (Aura's simulated auto-exposure, no luminance readback).
- Window frames read `sun.color` and `sky.horizon` for their 10–15% tint; window content is never lit or exposure-affected (D-008).

---

## 3. Zustand stores and persistence

Several small domain stores rather than one giant store: narrow subscriptions, obvious ownership, independent schemas.

| Store | Holds | Persisted |
|---|---|---|
| `session` | route phase (landing / selecting / loading / inWorld), `currentWorldId`, `worldPhase`, `loadProgress` | no |
| `windows` | `Record<id, WindowInstance>`, `focusedId`. Overlay windows hide in WORLD; one window per app (D-009) | yes: pinned windows per world + last overlay rects, not focus or carried state (a carried window saves as overlay) |
| `input` | owner stack, `shellState` (WORLD / SCREEN / RELEASED), `pointerLocked` | no (bindings live in settings) |
| `settings` | volumes (master, ambience, music, sfx, ui — labelled "Interface", on by default — app), `muted`, mouse sensitivity, invertY, `fovDeg` (55–75, default 62, clamped by the sanitizer), quality tier (`LOW\|MED\|HIGH\|ULTRA\|AUTO`), show perf HUD, key bindings | yes |
| `perf` | metrics published at 2 Hz, resolved AUTO tier | no (except last good AUTO tier, as a warm start) |
| `environment` | `EnvironmentState` (section 2.6) | no (worlds reseed it on enter) |
| `apps/<id>/store` | app-private data (Notes: notes list) | yes, per app key |

**Persistence format.** Zustand `persist` middleware (built-in version + `migrate`), one key per store:

```
ghiland:settings   { state: {...}, version: 1 }
ghiland:windows    { state: {...}, version: 1 }
ghiland:app:notes  { state: {...}, version: 1 }
```

- Each store exports `version`, `defaults`, `migrate(old, fromVersion)`.
- After migrate, **merge onto defaults and clamp** (a missing field gets its default, an out-of-range volume gets clamped). Hand-written sanitizers, no schema library in Alpha.
- A corrupt JSON blob gets moved to `ghiland:<key>:corrupt-<ts>` and the store starts from defaults. Never crash on boot because of storage.
- Storage goes through a `StorageAdapter` interface (`get/set/remove`), localStorage now, IndexedDB or an account backend later with no store changes.
- Not persisted in Alpha: last player position (D-009). You always enter at the world's spawn.

---

## 4. How DOM windows render in 3D: decision

**Decision.** Every window is **one persistent DOM element for its whole life**, whatever its mode.
- Overlay windows (screen-space) are positioned with plain CSS.
- Carried (camera-anchored) and pinned (world-anchored) windows get a **CSS `matrix3d` computed each frame by our own small projector** (the same math as Drei `<Html transform>` / three's `CSS3DRenderer`), written straight to `element.style.transform` with no React render.

**Rejected: render-to-texture as the main path.** Iframes can't be rasterized at all (cross-origin), text looks soft unless textures are huge, every UI change costs a texture upload, and pointer events have to be re-implemented through raycasts. It stays in reserve for WebXR (see below).

**Rejected: Drei `<Html transform>` per window as-is.** It's the right math but it portals content into its own container. Switching mode would re-parent the DOM node, and **re-parenting an iframe reloads it** and remounts React state. The mode switch is a core Ghiland interaction, so this is a real cost. We borrow Drei's math (~100 lines) instead of its component. If the projector proves troublesome, Drei Html is the fallback, and the cost is remounting on mode switch.

**Rejected: separate `CSS3DRenderer`.** Same idea but outside React/R3F, and it adds a second render loop to keep in sync.

Tradeoffs of the decision:

| Concern | Result |
|---|---|
| Text crispness | Real DOM text. Crisp in screen modes. In world-pinned mode, 520 px/m keeps body text ≥ 14 px at 1.75 m (section 2.4). Avoid `will-change: transform` on pinned windows (Chrome caches the raster at one scale, so it blurs when you walk closer). |
| Iframes | Work in every mode, and survive mode switches because the node never moves. |
| Pointer events | Native. In SCREEN, pinned and carried windows are hit-tested before "empty world". From WORLD, clicking a pinned window's content enters SCREEN with it focused, in place (Pixel). |
| Occlusion | DOM always draws over the canvas, so world geometry can't hide a pinned window by depth. Alpha: raycast from the camera to the window's 4 corners against **`occluder`-layer colliders only** at 10 Hz. Opacity follows the unblocked fraction, reaching 0 when fully blocked, and is smoothed between samples so it never steps. Glass, curtains and plants never occlude (Plan items 13–20), so a window stays visible from the terrace through the glass. Partial occlusion shows as a partly transparent whole window, not a clipped edge. That's an accepted Alpha limit. |
| Perf | Only transforms change per frame, and those are compositor-only. Budget ≤ 8 simultaneously visible world-pinned windows; frustum-cull them (`display:none` when off-screen). |
| Lighting / post-processing | Window content is never lit, fogged, bloomed or exposure-affected (D-008). Only the frame takes a 10–15% tint from `EnvironmentState` sun/sky colour, within Pixel's hue cap. |
| WebXR | DOM can't render in immersive sessions. The future XR path adds a `texture` surface for apps with `capabilities.xrSafe` (native apps only); embeds show a "not available in VR" card. The contracts already carry `xrSafe` and mode `space`, so this is additive. |

Layering: `WindowLayer` renders two DOM layers stacked on the canvas: a projected layer (pinned + carried windows, under) and a screen-space layer (overlay windows, over, hidden in WORLD). z-order is per layer.

---

## 5. Event bus: yes, small and narrow

A ~25-line typed emitter (`engine/events/bus.ts`, no dependency) for **one-shot moments that cross domains**:

```ts
// contracts/events.ts
export interface GhilandEvents {
  'world:loaded':   { worldId: string };
  'world:entered':  { worldId: string };
  'world:exited':   { worldId: string };
  'window:opened':  { windowId: string; appId: string };
  'window:closed':  { windowId: string; appId: string };
  'window:modeChanged': { windowId: string; from: WindowModeKind; to: WindowModeKind };
  'screen:toggled': { open: boolean };
  'player:interact': { targetId: string };
  'quality:changed': { tier: QualityTier; reason: 'user' | 'auto' };
  'shell:stateChanged': { from: ShellState; to: ShellState };
  'window:autoPinned': { windowId: string; reason: 'lockLost' };
  'gl:contextLost':  {};
  'gl:contextRestored': {};
  'audio:muteChanged': { muted: boolean };
}
```

Why: the audio engine plays UI cues, the perf monitor marks world transitions, and later analytics or a multiplayer layer mirror events, all without the window system importing any of them.

Rules: payloads are plain JSON (so they can go over a network later). Nothing is ever *read back* from an event. If a component needs to know the current state, it reads a store. No request/response over the bus.

---

## 6. Quality profiles and perf monitoring

```ts
// contracts/quality.ts
export type QualityTier = 'LOW' | 'MED' | 'HIGH' | 'ULTRA';
export type QualitySetting = QualityTier | 'AUTO';

export interface QualityProfile {
  tier: QualityTier;
  dpr: [min: number, max: number];
  shadows: 'off' | 'basic' | 'soft';
  shadowMapSize: 0 | 1024 | 2048 | 4096;
  postprocessing: { enabled: boolean; bloom: boolean; smaa: boolean };
  multisampling: 0 | 4;                  // EffectComposer MSAA samples (Plan items 13–20)
  foliage: 'alphaTest' | 'alphaToCoverage'; // cutout mode for leaves, grass, thin frames
  maxTextureSize: 1024 | 2048 | 4096;   // chooses which KTX2 variant to load
  drawDistance: number;                  // camera far + fog
  lodBias: number;
  particleDensity: number;               // 0..1
  water: 'low' | 'med' | 'high';         // Seaside-relevant [ASSUMPTION: Aura]
}
```

| | LOW | MED | HIGH | ULTRA |
|---|---|---|---|---|
| DPR | 0.75–1 | 1–1.5 | 1–2 | 1–device (cap 2.0) |
| Shadows | off | basic 1024 | soft 2048 | soft 4096 |
| Anti-aliasing | SMAA | SMAA | composer MSAA 4× | composer MSAA 4× |
| Foliage cutout | alpha-test | alpha-test | alpha-to-coverage | alpha-to-coverage |
| Other post | none | none | bloom | bloom + extras |
| Textures | 1K | 2K | 2K | 4K |

- **Anti-aliasing (Plan items 13–20), confirmed compatible with the permanent `antialias: false` canvas.** That flag only controls the default framebuffer. With an `EffectComposer`, the scene is never drawn to the default framebuffer: it's drawn into the composer's input target. `multisampling: 4` makes that input target a WebGL2 multisampled render target, which is exactly what alpha-to-coverage needs (`material.alphaToCoverage = true` turns on `SAMPLE_ALPHA_TO_COVERAGE` for the bound multisampled buffer). The composer resolves it before the effect passes, and the final pass writes to the canvas. pmndrs recommends `antialias: false` with the composer for this reason, since canvas MSAA would be wasted work.
- Every tier now runs the composer (LOW only for SMAA). HIGH and ULTRA drop SMAA because MSAA already covers geometry edges, which saves a pass.
- Switching tiers changes `composer.multisampling`, which reallocates render targets but not the WebGL context, so there's still no canvas remount. Switching foliage between `alphaTest` and `alphaToCoverage` changes shader defines, so foliage materials recompile once per tier change. Run that behind AUTO's existing hysteresis, and precompile with `gl.compile` during the loading screen for the starting tier.
- Cost: MSAA 4× at ULTRA's DPR cap is the largest single GPU-memory item. The ULTRA DPR cap drops from 2.5 to 2.0 so the multisampled targets stay inside the texture-memory budget.
- Needs WebGL2, which three.js already requires.
- **FOV (D-017).** `settings.fovDeg` (55–75°, default 62°) sets the camera's vertical FOV live, with no remount. World scale and pinned scale don't change with it.
- **WebGL context loss (D-017).** `ContextGuard` inside the canvas listens for `webglcontextlost` (calls `preventDefault()` so the browser may restore) and `webglcontextrestored`.
  - On loss: emit `gl:contextLost`, pause the frame loop and perf probe, and show a calm full-screen "Restoring" veil (Pixel styles it). Input goes to owner `system`; any carried window auto-pins as float first. DOM windows and app state are untouched, because they're DOM.
  - On restore: three re-uploads geometry and textures on the next render. We re-run `gl.compile` for the current tier, rebuild the composer's render targets, reset `gl.info`, hide the veil, and return to RELEASED ("Click to walk"), since pointer lock was likely lost.
  - If not restored within 5 s: the veil offers "Reload". Before reloading, stores are flushed to storage so pinned windows and notes survive.
- Worlds can override any field per tier (`WorldDefinition.quality`).
- **AUTO**: start from a heuristic (renderer string, `hardwareConcurrency`, `deviceMemory`, last good tier from storage). Drei `<PerformanceMonitor>` adjusts **DPR** continuously; a **tier** change needs 5 s sustained below 45 fps (down) or above 58 fps (up), at most once per 30 s, never in the first 3 s after entering a world. Hysteresis stops flicker between tiers.

**Perf monitor.** `PerfProbe` lives inside the canvas.
- Samples every frame into a ring buffer (ref): frame time, `gl.info.render.calls`, `.triangles`, `gl.info.memory.geometries/textures`.
- `gl.info.autoReset = false`, reset manually at frame start, so multi-pass post-processing is counted fully.
- JS heap from `performance.memory` (Chromium only, shows "n/a" elsewhere).
- Long tasks via `PerformanceObserver('longtask')`, because DOM windows cost CPU that `gl.info` never sees.
- Publishes averages to the `perf` store at 2 Hz; `PerfHud` (toggle key) reads the store. No `r3f-perf` dependency needed.

**Initial budget** (Seaside House, to be validated by Sentinel on real hardware):

| Metric | LOW | HIGH |
|---|---|---|
| Draw calls | ≤ 80 | ≤ 150 |
| Triangles on screen | ≤ 250k | ≤ 750k |
| GPU memory (est., textures + render targets) | ≤ 128 MB (no MSAA) | ≤ 384 MB (D-018; gating tier RTX 3060 class) |
| JS heap | ≤ 300 MB | ≤ 400 MB |
| Target fps | 30+ on integrated GPUs | 60 on M1 / mid laptop |
| Visible world-pinned windows | ≤ 4 | ≤ 8 |

Bundle budget (gzip): landing route ≤ 150 KB JS, no three.js. Shared engine chunk (three + R3F + Drei subset) ≈ 300 KB. Seaside world code ≤ 100 KB. Each native app ≤ 50 KB, lazy. World assets: first playable ≤ 25 MB, full world ≤ 60 MB (meshopt geometry + KTX2 textures). Time from the world-card click to walking ≤ 5 s on good broadband.

---

## 7. Audio engine

Own thin engine on Web Audio (`engine/audio`), rather than three's `Audio` / `PositionalAudio`, because we need buses, zones and crossfades that three's classes don't model.

**Graph**

```
source nodes ─▶ bus gains (ambience | music | sfx | ui | app) ─▶ master gain ─▶ mute gain ─▶ limiter (DynamicsCompressor) ─▶ destination
spatial emitters: source ─▶ PannerNode ─▶ (optional zone lowpass) ─▶ sfx or ambience bus
```

- **Unlock**: the `AudioContext` is created or resumed on the Seaside card click (single-page entry, Plan items 13–20). The loading experience then gets sound for free.
- **Volumes**: settings slider value v (0..1) maps to gain v². Changes use `setTargetAtTime` so there are no clicks.
- **Mute (D-017)**: a separate mute gain after master ramps to 0 over ~80 ms and back, so unmuting restores the exact mix. `M` in WORLD and the Settings toggle both flip `settings.muted`; it persists. Muting doesn't suspend the `AudioContext`, so streamed beds stay in sync.
- **Interface bus (D-017)**: the existing `ui` bus carries all UI cues and is its own "Interface" slider in Settings, on by default. Cues are soft and short (≤ 250 ms, peaking ≥ 12 dB under the ambience bed).
- **Captions**: none in Alpha 0.1, since there is no speech. Recorded as an accessibility item for later rare-event audio (D-017).
- **Long beds are streamed (Master ruling, Plan items 13–20).** Sea wash, wind bed, room tone and music play through `HTMLAudioElement` → `MediaElementAudioSourceNode` into their bus, so they cost almost no decoded memory. A 3-minute stereo bed decoded to float32 would be about 69 MB on its own (Sentinel X-12).
- **Gapless streamed loops.** `<audio loop>` can leave a gap at the seam in some browsers. Each bed uses two media elements and starts the second ~3 s before the first ends, with an equal-power crossfade. The first start also uses a random offset so repetition is harder to hear. Beds are served same-origin, so there are no CORS issues with `MediaElementAudioSourceNode`.
- **Decoded buffers only for one-shots and wave variations** (rock hits, gust swells, chimes, UI cues). They play through `AudioBufferSourceNode` for sample-accurate scheduling. Positional sources are stored and decoded as **mono**, since a panner only needs one channel, which halves their memory.
- **Cache**: LRU of decoded buffers keyed by URL, cap 64 MB (unchanged). Estimate for Seaside: 12 wave variations × 6 s mono at 48 kHz ≈ 14 MB, plus one-shots and UI cues ≈ 5 MB. That's well under the cap. Streamed beds don't count toward it, and the decoded-bytes test hook reports only buffers.

**Per-world spec (declarative, in the world definition)**

```ts
// contracts/audio.ts
export interface WorldAudioSpec {
  beds: AmbienceLayer[];        // non-spatial stereo layers: ocean, wind
  emitters?: SpatialEmitter[];  // positioned: waves at shoreline, wind chimes, fireplace
  music?: { src: string; gain: number }[];
  occlusion?: PortalOcclusion;  // how exterior sound reaches interior zones through open portals
}
export interface AmbienceLayer { id: string; src: string; gain: number; fadeInMs?: number }
export interface SpatialEmitter {
  id: string; src: string; position: Vec3; gain: number;
  refDistance: number; maxDistance: number; rolloff: 'linear' | 'inverse' | 'exponential';
}
// Zones and portals are the shared world-level ones from section 2.6.
export interface PortalOcclusion {
  exteriorSources: string[];             // bed/emitter ids treated as "outside" (ocean, wind)
  lowpassNearHz: number;                 // at an open portal (~3000)
  lowpassFarHz: number;                  // deep inside or in the corridor (~900)
  farDistance: number;                   // metres from the nearest open portal where "far" is reached
  interiorBedGain?: Record<string, number>; // e.g. wind bed ~0.25 inside (Aura)
}
```

- The listener follows the camera each frame (position + orientation AudioParams).
- In an interior zone, exterior sources pass through a lowpass whose cutoff follows the distance to the nearest **open** portal (Seaside: ~3 kHz at the open panels, ~900 Hz deep in the room or corridor), recomputed at 10 Hz and smoothed. Closing a portal later just flips `open`. Exterior zones hear everything unfiltered.
- Wind audio reads the same `EnvironmentState.wind` as the shaders: bed gain follows strength, the gust layer and rustles fire from `sampleGust` at the listener's position.
- Panner uses `HRTF` on HIGH/ULTRA and `equalpower` on LOW/MED.
- World transition: current beds fade out over 1.5 s while the next world's beds fade in behind the loading screen.
- UI cues are driven by bus events (`window:opened` plays a soft tick), so the shell never imports audio.
- RELEASED ducks ambience 3 dB; tab hidden or blur fades it 6 dB over 400 ms (Pixel).

---

## 8. Dependencies

The stated stack (Next, React, TS, R3F, three, Drei, Tailwind, Zustand, Framer Motion, Web Audio) covers almost everything.

| Dependency | Type | Why | When |
|---|---|---|---|
| `@react-three/postprocessing` + `postprocessing` | runtime | the composer carries all anti-aliasing (SMAA on LOW/MED, MSAA 4× for alpha-to-coverage on HIGH/ULTRA) without a canvas remount, plus bloom for the seaside mood | step 3 (all tiers, lazy-loaded with the engine) |
| `@gltf-transform/cli` | dev | compress assets: meshopt geometry + KTX2 textures. Drei `useGLTF` decodes meshopt out of the box | step 2 |
| `vitest` | dev | unit tests for migrations, projector math, collision, input stack | step 0 |
| `@playwright/test` | dev | smoke test: land, enter world, open Notes, reload, note persisted | step 9 |
| `leva` | dev, optional | live tuning panel for Aura (fog, light, audio gains), stripped from prod | when Aura needs it |

Explicitly **not** adding in Alpha:
- `@react-three/rapier`: no physics needed; AABB collision is ~100 lines. Revisit for throwable objects or multiplayer.
- `three-mesh-bvh`: until a world needs mesh collision.
- window libraries (react-rnd etc.): drag/resize is small with Framer Motion + pointer events, and Pixel's model will be custom anyway.
- zod, uuid/nanoid, mitt, r3f-perf: covered by sanitizers, `crypto.randomUUID()`, our 25-line bus, our perf probe.

---

## 9. Build plan for Forge (smallest playable first)

Each step ends in something runnable. Aura's art replaces greybox in parallel from step 2 on.

0. **Scaffold.** Next + TS strict + Tailwind + pnpm + Vitest. ESLint import-boundary rules. `contracts/` copied from this doc. Empty registries.
1. **Greybox walk + input state machine.** `<GhilandApp/>` with the persistent canvas, greybox with layered colliders, `FirstPersonController` (pointer lock, WASD, `strollFast`, Aura's numbers), AABB collision, owner stack with WORLD / SCREEN / RELEASED and `Q` toggle. *First playable. Checkpoint: Sentinel and Master try it before anything builds on it.*
2. **Worlds + loading.** World registry, SceneManager lifecycle, loading experience with real progress, disposal on unload, single-page entry (landing and world cards in one page, Seaside card click unlocks audio, "Click to walk" takes the first lock), 2 preview cards.
3. **Settings, quality, perf.** Settings store with persistence + migrations, quality profiles applied live (DPR, shadows, post), FOV setting, perf probe + HUD, `ContextGuard` with the Restoring veil.
4. **Environment + audio.** `EnvironmentDirector` (zones, gusts, exposure, shared uniforms), audio engine + buses (including Interface) + mute (`M`), sea beds and rock emitters, wind bed + gust layer, portal lowpass.
5. **Ghiland Screen + overlay windows.** Screen on `Q`, Esc ladder, launcher, windows store, overlay drag / resize / close / minimize, overlay hides in WORLD.
6. **Apps.** App host, Notes (persisted, own schema), AI-chat mock, one external-fallback app. Single-instance.
7. **Carry, pin, pick up.** Projector, detached (carried) mode, `resolvePlacement` (ray stops at any movement collider; free anchor ≤ 1.5 m, then pin surface with table tilt, then float with the 0.3 m glass rule), one window per anchor, constant 520 px/m, lock-loss auto-pin, `E` pick-up (≤ 25 m), far card, occluder-layer fade, pinned windows persisted per world. Unit-test `resolvePlacement` on the Seaside greybox before any UI.
8. **Seaside art pass + AUTO quality.** Ocean, curtains, reveal lighting from Aura; AUTO tier; event-driven UI sounds; budget check (section 6).
9. **Hardening.** Sentinel pass, Playwright smoke test, bundle analysis against budget.

---

## Resolved (Ghiland Master: DECISIONS.md D-004 to D-018, Plan items 13–20 and 23–29)

1. Detached means carried in camera space; `P` pins, `E` picks up, `Q` returns to the Screen.
2. Screen key is `Q`; `Esc` steps back inside SCREEN; `Tab` stays focus navigation.
3. SCREEN pauses movement; overlay windows hide in WORLD.
4. Pinned windows persist per world; player position is not persisted.
5. AI chat stays a mock in Alpha 0.1 (a real one needs a server route, a server-held key and the user's cost decision).
6. Apps are single-instance in Alpha 0.1.
7. Pins snap to an authored anchor within 1.5 m, otherwise to a wall or table, otherwise float facing you. Glass is never a pin surface (Plan items 13–20).
8. Pinned scale is 520 px/m, and colliders carry `movement` / `occluder` / `pinSurface` layers (Plan items 13–20).
9. Entry is a single page, and the world card click unlocks audio (Plan items 13–20).
10. AA: composer MSAA 4× with alpha-to-coverage on HIGH/ULTRA, alpha-test + SMAA on LOW/MED. Long audio beds stream, and only one-shots are decoded (Plan items 13–20).
11. Pinned scale is a constant 520 px/m and content is never scaled down; one window per anchor; the placement ray stops at any movement collider, tables take windows upright tilted 10° back, and glass gives a float fallback at least 0.3 m on the player's side (D-016, Plan items 23–25).
12. FOV setting 55–75° (default 62°); losing pointer lock while carrying auto-pins as float; WebGL context loss shows a Restoring veil with a reload offer after 5 s; `M` mutes; UI sounds on by default on their own Interface slider; captions deferred (D-017, Plan items 26–28).
13. HIGH GPU memory budget is 384 MB (RTX 3060 class gates it); LOW stays 128 MB with no MSAA (D-018, Plan item 29).
