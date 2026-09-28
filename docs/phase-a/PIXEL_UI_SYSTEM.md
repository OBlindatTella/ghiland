# Ghiland: UI System, Phase A
Author: Pixel (UI / UX / Interaction) · For: Ghiland Master · 2026-09-28 · Status: approved by Ghiland Master, rev 2 (folds in ALPHA_0.1_PLAN items 5, 13, 14, 16, 19, 21 and D-014), no code

Rev 2 changes: content in world windows is never exposure-affected, and only the frame takes a 10–15% world tint (6.7). Pinning snaps to authored pin anchors within 1.5 m, and glass is never a snap surface (3.3). Pinned scale is Atlas's 520 px/m, and the default Notes size is 440×560 (2.4, 3.3). Key hints fall back to QWERTY labels where there's no layout map (1.4). The three open questions are resolved (9).

Scope: Alpha 0.1 (Seaside House). Future modes (Follow, Focus, Ambient) and UI levels are placed in the system so they fit later, but they aren't specced in depth.
Read with: `GHILAND_STATE.md`, `DECISIONS.md`, and Aura's `aura/atmosphere-foundations-v0.md` (walk speed, idle drift, and the "Screen lives on the desk" handoff are taken from there).

The one-line model, which every section below serves:
**If the cursor is hidden, you're in the world. If the cursor is visible, you're using the Screen. `Q` switches between them. `Esc` steps back one layer. Clicking the world takes you back into it.**

---

## 1. Core input model (the most important part)

### 1.1 Three states

| State | Pointer | Mouse does | Keyboard does | What's visible |
|---|---|---|---|---|
| **WORLD** | locked (hidden) | look | move (`WASD`/arrows), `E` interact, `Q` open Screen | world, pinned windows, optional tiny reticle |
| **SCREEN** | free (visible cursor) | point, click, drag | belongs to the UI (typing, shortcuts). No walking. | world (dimmed 12%), overlay windows, launcher shelf, pinned windows |
| **RELEASED** | free | nothing, except clicking the world re-enters | `Q` opens Screen | world at full brightness, one quiet hint: "Click to walk" |

RELEASED is the "I lost pointer lock and didn't ask for the Screen" state: the browser took the lock (tab switch, window blur, a system dialog), or you stepped all the way back with `Esc`. It's never a pause menu. The world keeps running and ambient audio ducks by 3 dB.

Why no walking in SCREEN: one rule ("visible cursor = keyboard belongs to the UI") keeps the model learnable in seconds, removes WASD-vs-typing conflicts, and makes it safe to add type-to-search later.

### 1.2 Transitions

```
WORLD    ── Q, or Esc (browser unlock) ──▶ SCREEN
SCREEN   ── Q, or click on empty world ──▶ WORLD
SCREEN   ── Esc (after inner layers are closed) ──▶ RELEASED
RELEASED ── click on world ──▶ WORLD
RELEASED ── Q ──▶ SCREEN
any      ── tab hidden / window blur ──▶ RELEASED
```

- **`Q` from WORLD** calls `exitPointerLock()` and opens the Screen. Because we released the lock ourselves, re-locking has no browser cooldown.
- **`Q` from SCREEN** (no text field focused) closes the Screen and re-locks. The keydown counts as a user activation, so `requestPointerLock()` is allowed there. `Esc` never counts, which is why `Esc` can't be the way back.
- **Single click on empty world** while in SCREEN re-locks and returns to WORLD. Guards: it must be a click with less than 4 px of travel, not within 200 ms of a drag ending, and not on a window's 6 px resize halo. Pinned and detached windows are hit-tested before "empty world".
- **`E` looking at a pinned window** does the carry flow in section 3. **Clicking a pinned window's content** from WORLD enters SCREEN with that window focused, right where it is in the world (no camera move).

### 1.3 `Esc` and pointer-lock browser quirks (design around them, don't fight them)

- **`Esc` is owned by the browser while the pointer is locked.** We can't prevent it. So when the lock drops because of `Esc` in WORLD, we go to **SCREEN** (same result as `Q`). The user was reaching for their cursor, so we give them the Screen instead of a dead RELEASED state. This makes `Esc` and `Q` both mean "give me my cursor". Only `Q` and a click go back.
- **`Esc` ladder inside SCREEN** (keyboard is ours here). Each press steps back exactly one layer: close menu or popover → cancel drag or resize → blur the text field → close the Screen to RELEASED. It never closes windows, and it never re-locks.
- **Re-lock cooldown.** Chromium rejects `requestPointerLock()` made shortly after the user exits with `Esc` (roughly one second; Forge should measure the current value). Always handle the rejected promise / `pointerlockerror`. On failure, stay in SCREEN or RELEASED, show "Click to walk", and succeed on the next click. Never loop retries.
- **Activation expiry.** Pointer lock needs a recent gesture. A click on "Enter" on the landing page can't carry through a multi-second load, so the first lock is taken by the "Click to walk" click once the world is live (section 4).
- **Firefox shows its own "Press Esc to show your cursor" banner** on every lock. Our hints must never duplicate it or collide with it (no hint in the top-center 120 px for 3 s after locking).
- **Raw mouse input.** Request `{ unadjustedMovement: true }` where it's supported (Chromium) so sensitivity is consistent, and fall back silently. Clamp single-event `movementX/Y` spikes (a known bug on some Chromium/Windows builds after lock) to 3× the rolling average.
- **Browser shortcuts we can't intercept** (`Ctrl/⌘+W`, `Ctrl+T`, `Ctrl+N`, `Ctrl+Tab`): never assign them. Notes autosaves continuously, so an accidental tab close loses nothing.
- **Fullscreen.** `Esc` also exits fullscreen. Alpha doesn't force fullscreen. A later "Immersive" option can use the Keyboard Lock API (Chromium, fullscreen only) to turn exit into hold-`Esc` for 1 s. That's deferred.
- **Tab hidden or blur.** Go to RELEASED and fade ambient audio by 6 dB over 400 ms. When the tab comes back, don't re-lock automatically (the browser won't allow it anyway). The hint says "Click to walk".

### 1.4 Keys (Alpha default map)

All bindings are defined per action in one keymap table and matched on `KeyboardEvent.code` (physical position), so WASD stays in the right place on AZERTY and on the Italian layout. On-screen keycap hints always read the key from the keymap table and label it with `navigator.keyboard.getLayoutMap()`. Where that API is missing (Firefox, Safari), hints show the QWERTY label. Wrong labels on non-QWERTY layouts in those browsers are a recorded known limitation until remapping ships. The bindings themselves still work on every layout.

| Action | Default | Notes |
|---|---|---|
| Move | `W A S D` / arrow keys | 1.3 m/s, eased (Aura §6). No run by default. |
| Look | mouse (WORLD) | sensitivity in Settings, invert Y option |
| Open / close Screen | `Q` | the one key to learn |
| Interact / carry / put down | `E` | doors, objects, pinned windows |
| Pin focused window | `P` (SCREEN, no text focus) | same as the pin button |
| Step back | `Esc` | ladder in 1.3 |
| Cycle windows and launcher | `F6` / `Shift+F6` | accessibility standard |
| Focus launcher | `/` (SCREEN, no text focus) | later: type to search |

Why `Q` and not `Tab`: `Tab` has to stay keyboard focus navigation inside the Screen for accessibility, and a toggle key that works in one state and not the other isn't learnable. `Q` sits next to WASD, isn't used for movement, and is remappable later. Trade-off: `Q` types a "q" while a text field has focus, so from a focused field it's `Esc` then `Q`, or a click on the world. That matches how every game handles chat.

### 1.5 Cursor landing position

When the lock is released, the OS cursor reappears where it was at lock time, and we can't move it. So nothing in the Screen may depend on hover at the first frame (no hover-open menus, no tooltips that fire on appear). The launcher and windows open where they belong, and the cursor finds them.

### 1.6 Reticle

In WORLD the default is no reticle. A 4 px dot fades in (120 ms) only while you're looking at something interactable within range (a pinned window, a door, the coffee cup). On a pinned window the window's edge gets a 1 px outline in its accent. That's the whole HUD.

---

## 2. Ghiland Screen

### 2.1 What it is

The Screen is your spatial desktop: the layer where digital things live, as an overlay on the world. In Seaside House it also has a physical home. There's a real device on the desk (Aura's handoff), and when you look at it and press `E` from within 2 m, the Screen opens exactly like `Q` does. It's the diegetic way in, and `Q` is the fast way from anywhere.

### 2.2 Summon and dismiss

- **Summon (`Q`, `Esc` in WORLD, or `E` on the desk device):** pointer unlocks; the world dims 12% (a flat darken, no blur, since blur is reserved for Focus mode); the launcher shelf rises 12 px and fades in (240 ms, ease-out); overlay windows restore to exactly where you left them, each fading and scaling from 0.98 (240 ms, staggered 20 ms). Idle camera drift (Aura §6) pauses while the Screen is open.
- **Dismiss (`Q`, or a click on the world):** the reverse, 160 ms (leaving is always faster than arriving). Overlay windows tuck away, not close. Pinned windows are unaffected.
- **Empty Screen:** no windows means just the shelf. No wallpaper, no widgets, no welcome text. The world is the wallpaper.

### 2.3 Launcher layout

- A single **shelf** anchored bottom-center, 16 px off the bottom edge: one row of app tiles, 40 px glyphs on 56 px hit targets with 8 px gaps. No labels by default. A label appears above a tile after 400 ms of hover or immediately on keyboard focus (13 px). The shelf is sized to its contents. It isn't a full-width bar.
- **Alpha apps, in order:** Notes, Chat (AI mock), Worlds, Settings. A thin 1 px divider separates the apps from the **window tray** (section 3.5).
- **Open indicator:** a 4 px dot under the tile when the app has a window open anywhere (overlay, carried, or pinned).
- **Keyboard:** `/` focuses the first tile, arrows move, `Enter` opens, `Esc` leaves the shelf.
- **Later:** type-to-search appears as a field at the left end of the shelf once there are more than about 8 apps. Not in Alpha.

### 2.4 How apps open into windows

- Click a tile: the window grows out of the tile's position into its target rect (240 ms, standard easing, with opacity going from 0 to 1 over the first 120 ms). You see where it came from.
- **Single instance in Alpha.** If the app is already open, clicking its tile focuses that window wherever it is. If it's in the tray, it restores. If it's pinned in the world, the pinned window gets a 600 ms accent outline pulse and the tray entry is highlighted, and a second click brings it into the overlay (the same as Recall in 3.6). Nothing is ever duplicated silently.
- **Placement:** the first window opens centered at 720×480 (Notes 440×560, Chat 440×620, Settings 480×560, Worlds 720×460). Each further window cascades +32 px right and down from the focused one, clamped to the safe area (24 px margin, above the shelf). Last position and size are remembered per app.
- Opening an app always focuses it and puts the keyboard in its primary field (Notes: the page; Chat: the input).

---

## 3. Window interaction

### 3.1 The 30-second version (this is the onboarding)

1. `Q` opens your Screen. Click an app.
2. Drag the title bar to move. Drag an edge to resize.
3. Press the **pin** button (or `P`) and the window stays in the world, right where you're looking.
4. Walk away and it stays. Look at it and press `E` to pick it up and carry it. Press `E` again to put it down somewhere else.

Everything else (snapping, minimize, recall) is discoverable and never required.

### 3.2 Window modes for Alpha, and where future modes fit

| Mode | Space | Lit by world? | Occluded by world? | Alpha |
|---|---|---|---|---|
| **Overlay** | camera-relative screen space, always on top | no | no | yes, the default |
| **Detached (carried)** | world space, held about 1.1 m in front of you with a soft lag of about 150 ms | yes (Aura) | yes | yes, basic |
| **World Pinned** | world space, fixed anchor, stays when you leave | yes (Aura) | yes | yes, basic |
| Follow | world space, stays still while you look around, glides back into view when you walk off | yes | yes | later (it's Detached with smarter repositioning) |
| Focus | overlay, one window, world blurred and dimmed about 60% | n/a | n/a | later (a state of Overlay) |
| Ambient | any mode at 40–60% opacity, click-through until hovered | per mode | per mode | later (an opacity layer) |

"Detached" in Alpha means **carrying**: the window has left your Screen and is a physical object moving with you. Putting it down pins it. This keeps the Overlay → Detached → Pinned chain linear and easy to explain.

### 3.3 The Overlay → Detached → Pinned flow and back

```
OVERLAY ── pin button / P ────────────────▶ PINNED (placed where you look)
OVERLAY ── drag title bar off the top or side edge and hold 300 ms ─▶ DETACHED (you're now carrying it; Screen closes, pointer locks)
DETACHED ── E ────────────────────────────▶ PINNED at the preview spot
DETACHED ── Q ────────────────────────────▶ OVERLAY (back on your Screen)
PINNED ── look + E (any distance, line of sight, ≤ 25 m) ─▶ DETACHED (flies to you, 360 ms)
PINNED ── "return to Screen" button in its chrome, or Recall in the tray ─▶ OVERLAY
```

**Placement rule (when pinning or putting down):** raycast from the camera center up to 3 m, and check in this order.
- If the hit is within 1.5 m of an authored **pin anchor** (a `pinAnchor` placed by Aura), the window snaps to that anchor's position and angle. Seaside has the hero anchor `hero-sea`, 0.6 m from the glass and angled 15° toward the room.
- **Glass is never a snap surface.** A hit on glass is treated as if it hit nothing (it floats, below), unless an anchor is in range.
- If it hits a surface less than 35° from vertical (a wall, a shutter, a bookshelf face), the window **snaps flat to it**, offset 1 cm, and stays upright.
- If it hits a horizontal surface (the desk or a table), the window **stands on it**, tilted back 12° like a propped-up screen.
- If it hits nothing, it **floats** 1.6 m ahead at eye height, facing you, and stays upright.

While you're carrying a window, a flat 1 px accent outline previews the spot where it will land (no ghost glow). The world size of a pinned window is its overlay size mapped at Atlas's **520 px/m**. At that scale, body text renders at about 14.8 px on a 1080p screen from 1.75 m. The default 440×560 Notes window pins at about 0.85×1.08 m. **At `hero-sea`, the default pinned size is capped at 0.85×1.08 m** so the sea view stays framed. A window larger than that is scaled down to fit when it lands on the anchor, keeping its aspect ratio. After placement, resizing is allowed as usual. Size is adjusted only by resizing, never by scaling gestures in Alpha.

**Grabbing a pinned window from across the room:** look at it (the reticle dot and edge outline appear), press `E`, and it flies to you and you're carrying it. At any time you can press `Q` to take it back onto your Screen instead. When you're farther than 6 m away, a pinned window swaps to a **far card** (app glyph + title, content paused) so it doesn't shimmer and stays cheap to render.

**Using a pinned window where it is:** from WORLD, click on its content, or while in SCREEN just click it if it's in view. The pointer is hit-tested against the window's world quad and mapped to its content. Typing works as in any window. This is the "Notes pinned next to the sea view" moment from the success test: you walk up, click, and write.

### 3.4 Drag, resize, snap (Overlay)

- **Drag:** the whole 32 px title bar is the grip (except its buttons). Drag starts after 4 px of travel. The window follows the pointer 1:1 with no easing (easing during a drag feels like lag).
- **Resize:** invisible hit zones 6 px outside each edge and 14 px square at each corner, with the matching cursor. Minimum size 320×200. Maximum is the safe area. A subtle 2-line grip mark appears at the bottom-right only on hover.
- **Snap, with an outline preview only (1 px, accent, 60% opacity, no fill glow):**
  - Drag to the left or right edge: half of the safe area.
  - Drag to the top edge: "large", the safe area minus 48 px of world on every side. Never true fullscreen, so the world stays visible. Fullscreen belongs to Focus mode later.
  - Window edges and centers magnet to other windows' edges and the screen center line within 8 px. Hold `Alt` while dragging to disable magnets.
  - Double-click the title bar: toggle large / previous size.
  - Dragging off the top or side edge and holding 300 ms instead detaches the window (3.3). A snap outline changes to a "lift" indicator (the window scales to 0.96 and gains a stronger shadow) so the two outcomes never look alike.
- **Pinned and carried windows** aren't drag-snapped. Placement is the snap (3.3).

### 3.5 Focus, z-order, minimize, close

- **Focus and z-order:** a pointerdown anywhere on a window raises and focuses it. Exactly one window has focus. A focused window has chrome at full contrast and its accent 1 px top edge. Unfocused chrome text drops to 64% opacity. Content is never dimmed, since you should still be able to read everything. Z-order is per space: overlay windows stack above everything; world windows are depth-sorted by the renderer.
- **Minimize:** an Overlay window shrinks into its entry in the **window tray** on the shelf, to the right of the divider (240 ms, toward the tray position). A tray entry is a 40 px thumbnail of the window's last frame. Click to restore it to its exact rect. Hover shows the title.
- **Minimizing a pinned window** collapses it in place into a **pin tag**: a small physical tag (about 8 cm) at its anchor, lit by the world, with the app glyph. `E` or a click on the tag restores it. It never leaves its place, because pinned things staying put is the promise.
- **The tray also lists pinned windows** (their thumbnails carry a small pin mark). Clicking one opens a two-item popover: **Recall** (bring it into the overlay) or **Show** (a 600 ms outline pulse on it in the world, plus a direction hint at the screen edge if it's off-screen). This is the way back to a window you left on the terrace and can't see.
- **Close:** × in the chrome. No confirmation in Alpha. Notes autosaves on every change (debounced 300 ms), and Chat mock history persists. Closing animates to the tile (160 ms).

### 3.6 Window chrome buttons (right side of the title bar)

`–` minimize · pin (becomes "return to Screen" when the window is pinned or carried) · `×` close.
The buttons are 14 px glyphs in 28 px hit targets. They stay at 40% opacity while the window is idle and go to 100% when the window is hovered or focused. Order and positions never change between modes. Only the pin glyph changes state.

---

## 4. Landing, world selector, loading: the first 20 seconds

Principle: **sound before image, image before interface, the world before words.** One page, no route changes, no spinner, no percentage.

| t | What the user sees and hears | What's happening |
|---|---|---|
| 0–0.8 s | A warm dark screen tinted from the Seaside palette (never pure black). The Ghiland wordmark, small, bottom-left. | The HTML shell paints. Seaside core assets start streaming right away. The shader warm-up is queued. |
| 0.8–2 s | Three world cards fade in. **Seaside House** is large and center-left, with a silent 6 s loop rendered from the exact spawn camera. **NY Balcony** and **Golden Hour Farm** are smaller and desaturated to 40%, each with one word: "Soon". | Card media is under 300 KB each (a poster frame first, then a short loop). |
| hover | Seaside's loop plays; the preview cards play theirs. At most one line of text per card. | Preview cards can't be entered. A click shows its one line and a small "Alpha 0.2" note. |
| click Seaside (or `Enter`) | The card expands to fill the screen (600 ms, shared-element transition). **Sea audio fades in immediately** (this click unlocks Web Audio). The card image is now the loading backdrop, blurred 24 px. | This is the gesture that satisfies the autoplay policy. Loading continues in the background. |
| loading (target ≤ 8 s on a mid-range laptop) | The backdrop slowly sharpens (blur goes from 24 to 0 px in step with real progress), and a 1 px line crawls along the bottom edge. No text, unless it runs past 10 s, when one quiet line appears: "Still arriving…". | Asset streaming, shader precompile behind the backdrop, the first frames rendered offscreen. |
| world ready | The backdrop crossfades (1200 ms) into the **live render from the same camera pose**, so the image comes alive with no cut. Curtains start moving, and the sea you've been hearing now has a place. After 600 ms a single hint fades in at the bottom center: "Click to walk". | We wait for 3 stable frames (under 20 ms) before crossfading, so the first seconds never stutter. |
| click | Pointer locks and the hint fades out. Onboarding hints start (section 5.2). | First WORLD state. |

- **Returning users:** the landing page opens with Seaside already focused. `Enter` or a click goes straight in. A remembered world selection skips nothing else, since the arrival *is* the product.
- **Failure states:** if WebGL2 is unavailable, show one line plus a link to what's needed. If loading stalls past 30 s, show "Try Low quality" as a single button. No stack traces in the UI.
- **The world selector later** lives in the Worlds app on the Screen, using the same cards. Switching worlds uses the same backdrop-to-live transition.

---

## 5. Settings and first-run onboarding

### 5.1 Settings (an app window like any other, 480×560)

One scrolling column, grouped by small section labels (12 px, 64% opacity). No tabs, no Save button, and every change applies live, with the world visible behind so you can feel it.

- **Sound:** Master volume and Ambient volume sliders (0–100, shown as a number while dragging only). Also a "Mute when tab is hidden" toggle, default on.
- **Controls:** Mouse sensitivity slider (0.1–3.0, default 1.0). The next time you enter WORLD, the new value applies, and the Settings window stays open on your Screen so you can go back and adjust. Invert Y toggle. Key bindings listed read-only with "Remapping comes later".
- **Graphics:** Quality as a segmented control: `Low · Med · High · Ultra · Auto` (default Auto). With Auto selected, a quiet suffix shows what it resolved to ("Auto · High"). Changes are debounced 400 ms and applied behind a 200 ms fade so the hitch isn't seen.
- **Interface:** Reduce motion (defaults to the OS setting). UI level (Zero · Minimal · Normal) is shown but disabled until after Alpha, so the setting's home already exists.
- **About:** version, and a "Reset hints" link.

### 5.2 Onboarding: hints that fade, never tutorials

- A hint is one line: a keycap plus at most 3 words, 13 px, bottom-center 64 px above the edge, on a small dark pill at 86% opacity. Only one hint is ever on screen. It fades in over 240 ms and out over 400 ms.
- A hint disappears **as soon as the action is performed**, or after 12 s. Each hint is shown at most twice in its lifetime and is retired permanently once performed. State is stored locally.

Sequence, all triggered by context, not by time alone:
1. After the first lock: `W A S D` "to move". Retired after 2 m walked.
2. After 20 s of walking, or when near the desk device: `Q` "your Screen".
3. The first time a window has been open for 8 s: a coach mark by the pin button, "Pin it here". This is the only hint that points at UI.
4. The first time you're more than 2 m from a pinned window and looking at it: `E` "to carry".
5. The first RELEASED state: "Click to walk · `Q` Screen".

No modals, no "Next" buttons, no welcome text, no tooltips on things that already explain themselves.

---

## 6. Design tokens

Tokens are named by role, not appearance. The **base** set is world-neutral. The **world** set is overridden per world (6.7). Values are starting points for Forge's prototype and should be tuned on screen against the real Seaside render.

### 6.1 Type

- **Family:** *Atkinson Hyperlegible Next* for UI, with *Atkinson Hyperlegible Mono* for keycaps, numbers, and timestamps. It's free (OFL), highly legible over busy lit 3D backgrounds, and has a quiet character without being a stock SaaS face. Fallback: `system-ui`. Alternative if Master prefers something softer: *Instrument Sans*.
- **Scale (px / line-height):** `xs 11/16` · `sm 12/16` · `base 13/20` · `md 15/22` · `lg 18/24` · `xl 22/28`. **22 px is the ceiling.** Nothing in Ghiland UI is bigger. World names on the landing cards use `lg`.
- **Weights:** 400 and 600 only. No all-caps except keycaps. Letter-spacing 0, except `xs` at +0.2 px.
- **Notes content** defaults to 15/24 so it reads like paper rather than UI.

### 6.2 Color (base, dark-on-world)

| Token | Value | Use |
|---|---|---|
| `surface` | `#141413` at 90% opacity | window body |
| `surface-raised` | `#1C1C1A` at 94% | popovers, menus, the shelf |
| `scrim` | `#000` at 12% | world dim while the Screen is open |
| `text-1` | `#F2F0EB` | primary |
| `text-2` | `text-1` at 64% | secondary, labels |
| `text-3` | `text-1` at 40% | disabled, decorative only (never essential info) |
| `hairline` | `#FFFFFF` at 10% | borders, dividers |
| `accent` | world-defined (Seaside: sea-glass `#86BDB2`) | focus, selection, snap outline, open dots |
| `danger` | `#D9735E` | destructive actions only |

No pure white or pure black anywhere (this matches Aura's checklist). No gradients on chrome. `backdrop-filter` blur is **off** by default. If the prototype shows busy backgrounds hurting legibility, the maximum is 8 px, and only on `surface-raised`. Surfaces rely on opacity, not glass.

### 6.3 Spacing and radii

- 4 px grid: `4 · 8 · 12 · 16 · 24 · 32`. Window content padding is 16. Safe-area margin is 24.
- Radii: `window 10` · `control 6` · `tile 8` · `keycap 4` · `pill 999` (hints only).

### 6.4 Elevation

- Overlay windows use a single shadow, `0 8px 24px rgba(0,0,0,0.32)`, and a focused window uses `0 12px 32px rgba(0,0,0,0.40)`. No colored shadows, no glows, no inner glows.
- World windows get no CSS shadow. Aura's lighting provides contact shadow and occlusion.

### 6.5 Motion

| Token | Duration | Use |
|---|---|---|
| `instant` | 90 ms | hover and press states |
| `quick` | 160 ms | fades, dismiss, close |
| `base` | 240 ms | window open, minimize, Screen summon |
| `spatial` | 360 ms | fly-to, overlay↔world mode changes |
| `stage` | 600 ms | landing card expand, the pulse on a window being shown |
| `arrive` | 1200 ms | loading backdrop → live world crossfade |

Easings: `standard` `cubic-bezier(0.2, 0, 0, 1)` (arrivals), `exit` `cubic-bezier(0.4, 0, 1, 1)`, `linear` for progress only. Spatial moves (fly-to, carry lag) use a critically damped spring (stiffness 260, damping 32), so there's no bounce. Nothing in Ghiland overshoots, because calm doesn't wobble.
Reduced motion: every transform animation becomes a 120 ms opacity fade, fly-to becomes fade-out/fade-in at the destination, and the landing card expand becomes a crossfade.

### 6.6 Window chrome anatomy

```
┌───────────────────────────────────────────────┐  radius 10, 1 px hairline border
│ [glyph 14]  Title (12/600, text-2)   –  ⌖  × │  title bar 32 px = drag grip
├───────────────────────────────────────────────┤  (no divider line; content starts flush)
│                                               │
│   app content (app owns padding, 16)          │
│                                               │
└──────────────────────────────────────────────◢┘  resize halo 6 px outside, corners 14 px
```

- Focused: a 1 px `accent` line on the top edge, inside the radius, plus the stronger shadow.
- The title text hides below 360 px width. The glyph always stays.
- **World variant (pinned or carried):** the same layout plus a physical bezel about 1.5 cm deep, so the window reads as an object, not a sticker. The content is unlit and never exposure-affected, so it reads exactly as it does in the overlay. Only the frame and bezel take the world's light and tint. The chrome buttons scale up 1.25× for hit-testing at a distance. Far card beyond 6 m.

### 6.7 Where tokens adapt per world (coordinate with Aura)

Pixel owns layout, chrome geometry, type, states, and motion. Aura owns how windows sit in the lit world. Per-world overrides:

| Token | Overlay | World windows | Owner |
|---|---|---|---|
| `accent` | per world | per world | Aura picks, Pixel checks contrast (≥ 3:1 on `surface`) |
| `surface` tint | hue shifted up to ±8° toward the world's ambient | same | Aura proposes, Pixel caps |
| `surface` opacity | fixed 90% | 92–100% (can be more solid in bright light) | Aura |
| content brightness | constant | constant: unlit, never exposure-affected (Master, plan item 5) | fixed |
| frame world tint | n/a | 10–15% world tint on the frame and bezel only, within the ±8° hue cap | Aura, cap by Pixel |
| bezel material, edge, contact shadow | n/a | per world (Seaside: sun-faded painted wood or linen edge) | Aura |
| scrim strength | 12% day; 8% at night | n/a | Pixel |

**Answer to Aura's handoff question, "does UI dim with evening light?":** No. Window content never dims or brightens with the world, in the overlay or pinned (Master's ruling for Alpha). The world shows up only in the frame, through a 10–15% tint. At night a pinned Notes page therefore reads like a real screen in a dark room. Night also lowers the overlay scrim to 8%, since the world is already dark.

---

## 7. Accessibility baseline (Alpha)

- **Keyboard:** everything in SCREEN is reachable without a mouse. `Tab`/`Shift+Tab` move within the focused window. `F6` cycles windows and the shelf. `Enter`/`Space` activate. Arrows work in the shelf and segmented controls. Window move and resize by keyboard go through a window menu (`Alt+Space` style) after Alpha, and are listed as a known limitation.
- **Focus visible:** a 2 px `accent` ring with a 1 px `surface` offset on every focusable element, shown on keyboard focus only (`:focus-visible`).
- **Contrast:** `text-1` and `text-2` meet ≥ 4.5:1 against `surface` over a worst-case pure white background (90% opaque `#141413` over white composites to about `#2C2C2B`: `text-1` is about 11:1, `text-2` about 5.5:1). `text-3` is never used for essential information. World window content is unlit and uses the same tokens, so it keeps the same contrast in every light.
- **Reduced motion:** honor `prefers-reduced-motion`, with an in-app override (6.5). It also disables idle camera drift and turn lag.
- **No pointer lock alternative:** a "Drag to look" control mode (hold the left mouse button and drag to look, no lock) for users who can't use pointer lock, on touchpads, or when a browser refuses the lock. Arrow keys also turn when `Shift` is held. It's in Settings → Controls and offered automatically after 2 failed lock attempts.
- **Screen readers:** each window is a DOM landmark (`role="region"`, `aria-label` = app name), not a modal dialog. Hints go through a polite live region. The 3D world itself isn't described in Alpha, which is a known limitation.
- **Comfort:** no flashing, no screen shake, no head bob (Aura §6). A field-of-view slider is deferred to Alpha 0.2.
- **Remappable keys later:** the action-based keymap table (1.4) is the foundation, so remapping is a UI project, not a refactor. Physical-key matching and layout-aware labels ship in Alpha.

---

## 8. UI levels (future, how they map)

| Level | WORLD shows | SCREEN shows |
|---|---|---|
| Zero UI | nothing (not even the reticle); pinned windows as far cards unless you're within 2 m | only windows, no shelf until you hover the bottom 24 px |
| Minimal (Alpha default) | the contextual reticle, pinned windows, hints until they're retired | shelf + windows |
| Normal | + a small clock/presence pip in a corner (later) | + the tray always expanded |
| Focus | n/a | one window, world blurred and dimmed about 60%, shelf hidden |

---

## 9. Handoffs and open questions

- **Atlas:** a UI state store with `inputState` (WORLD / SCREEN / RELEASED), a window registry (id, app, mode, overlay rect, world anchor, z, minimized), a keymap table keyed by action, and hints state. The pointer-lock controller owns every lock and unlock call and is the only code that does.
- **Forge:** build the input state machine and pointer-lock handling first and test it on Chrome, Firefox, and Safari (measure the re-lock cooldown). Then overlay windows (drag, resize, snap). Then pin, carry, and put down with the placement raycast. World windows stay real DOM projected with CSS `matrix3d` (Atlas), so typing in pinned Notes works natively. Forge still owns occlusion and depth-sorting against the world.
- **Aura:** accent and surface tint for Seaside, the bezel material, the 10–15% frame tint, the look of the desk device, and the pin tag object.
- **Sentinel:** the 30-second learnability test with someone new (success = pins a window and carries it without being told how, after hints only), pointer-lock edge cases (Esc spam, alt-tab while carrying, tab switching during load), and contrast checks on real renders at golden hour and at night.
- **Resolved by Master:** `Q` is the Screen key. Apps are single-instance in Alpha. Overlay windows hide in WORLD. Entry is the single landing page, and clicking the world card unlocks audio.

---

SUMMARY: The Phase A UI system for Ghiland Alpha 0.1. It covers a three-state input model built around one key (`Q`), the Ghiland Screen and launcher, the window and mode system (Overlay → carried → Pinned and back), the first 20 seconds, settings and fading hints, design tokens, and an accessibility baseline.
WHAT WAS DONE: Designed and wrote the full interaction and visual system spec, aligned with GHILAND_STATE, DECISIONS, and Aura's atmosphere foundations. It answers Aura's "does UI dim at night" question.
FILES / SYSTEMS AFFECTED: `docs/phase-a/PIXEL_UI_SYSTEM.md` (new). No code.
IMPORTANT DECISIONS: `Q` toggles between WORLD (locked) and SCREEN (cursor); `Esc` in WORLD also opens the Screen; the way back is `Q` or a click on the world. No walking in SCREEN. "Detached" means carrying, and putting it down pins it. `E` grabs a pinned window from up to 25 m. Minimized pinned windows become pin tags in place. Overlay windows hide in WORLD. Atkinson Hyperlegible, a 22 px type ceiling, no blur by default, no glows, no overshoot.
RISKS: Pointer-lock behavior differs by browser (re-lock cooldown, Firefox banner, movement spikes). Click-on-world-to-return could cause accidental exits (mitigated by guards). `Q` may conflict with future bindings.
KNOWN LIMITATIONS: Not validated on screen. Tokens are starting values to tune against real renders. No keyboard move/resize for windows in Alpha. The 3D world isn't screen-reader accessible. Follow, Focus, and Ambient are only placed, not specced.
RECOMMENDED NEXT ACTION: Master confirms the three open questions (the `Q` key, single-instance apps, hidden overlay in WORLD). Then Forge prototypes the input state machine and overlay windows first, as a greybox, so the model can be felt and tuned before any visual polish.
