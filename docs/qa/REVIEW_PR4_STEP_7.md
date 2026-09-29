# Sentinel code review: PR #4, step 7 (carry, pin, keep windows in the world) plus S3 fixes
Author: Sentinel · 2026-09-29 04:20 CEST · Read-only static review. The only code I ran was throwaway numeric checks in `/tmp` (deleted)

- **Repo and commit.** github.com/OBlindatTella/ghiland, PR #4 "Carry, pin, and keep windows in the world". **Reviewed commit: `675a9f59c9eb4353ac816054f258076864f00516`**, the squash merge on `main` (merged 2026-09-29 04:08:56 CEST). PR head `d26cb14`, base `9bebec2`, 28 commits, +3358/−221, 64 files.
- **Method.** Read the PR file list and every patch through the cursor-github connector. Read these full files at `675a9f5`: `QualityDirector.tsx`, `autoQuality.ts`, `persistence.ts`, `apps/notes/storage.ts`, `Notes.tsx`, `InputManager.ts`, `WindowLayer.tsx`, `shellMachine.ts` and `seaside-house/definition.ts`. All nine match the patch hunks. Nothing was cloned and nothing was posted to GitHub. Severities follow test plan **v0.5** §1.1, including the D-028 overrides.
- **What I ran.** In `/tmp/sentinel-pr4` (deleted afterwards): an exact JS re-implementation of `collision.ts` at `675a9f5` with the `level.ts` boxes (sweeps at 1.35 m/s, dt 1/60), the D-023 normal and pane check, the carry-spring eigenvalues, and the placement geometry.
- **Ray sets.** Judged against the canonical D-032 text in `docs/DECISIONS.md`: crosshair/pick-up = walls/occluders + window quads, ≤ 25 m, **no placement boxes**.
- **Line numbers.** They come from the PR patches (new-file lines). I didn't compare every blob SHA against `675a9f5`, but the squash has the same tree as the head for the nine files read in full. Functions outside the hunks are cited by name.
- **Builder's runtime claims.** Treated as claims (see "Builder claims" below).
- **Screenshots.** The PR-body artefacts are behind a cursor.com login. **Not seen.**

---

## S3 fix status

| ID | Finding (PR #3) | Status | Evidence at `675a9f5` |
|---|---|---|---|
| S3-01 | Invisible walls from `holdOpeningEdge` | **PARTIAL** | The hold now applies only within the capsule radius of a box's expanded corner (`collision.ts` L71–90). Numerically the room-wide rails are gone: centre at 70° reaches x 6.34, backward diagonals are free, and spawn → hero stance (4.92, 2.16) arrives in 9.25 s with no hold. **Snags remain at coplanar seams and near corners (S4-01, BLOCKER per D-028/MOV-18).** Step 7 adds no movement colliders (soffit and curtains are `[]`), so there are no new rails from new boxes |
| S3-02 | Context loss throws in the post stack | **FIXED in code. Runtime unverified (RUL-28a)** | Three layers. (1) CanvasRoot no longer subscribes to `lost`; `frameloop="always"` (`CanvasRoot.tsx` L49–54), so the tree doesn't re-render on loss. (2) `FrozenPost` + `memo(PostStack)` holds the profile while lost and remounts by key after restore (`QualityDirector.tsx` L146–171); `apply()` and the 400 ms timer skip while lost (L58, L72). (3) `getContextAttributes()` falls back to a fixed object on a lost context (`ContextGuard.tsx` L10–29), so the `alpha` read can't throw. `CanvasBoundary` ignores context-loss errors (L20–31; residual S4-18). Pointer: `releasePointerLock()` exits now, in a microtask and at 0 ms (`InputManager.ts` L382–390). D-017 auto-pin runs through `apply(blur)` → `setBeforeShellChange` (WindowRig) |
| S3-03 | 200 k cap on the whole store | **FIXED** (residual S4-03) | Per-note records, `NOTES_MAX_CHARS` 2,000,000, warning at 80% (`storage.ts` L14–31; `Notes.tsx` L108–116, "This note is getting long.") |
| S3-04 | Two tabs overwrite each other | **PARTIAL** | Web Lock single writer, a "yield" over BroadcastChannel, and a read-only "Ghiland is open in another tab" / "Use here" state (`storage.ts` L154–209; `Notes.tsx` L121–140). **A tab that was the writer and takes the lock back reloads from its stale in-memory cache and overwrites the other tab's work (S4-02, BLOCKER).** With no `navigator.locks`, every tab is a writer (S4-14) |
| S3-05 | No unload flush | **FIXED** | `pagehide` + `visibilitychange=hidden` → `flushNotes()` starts the IDB transaction synchronously on a kept connection (`storage.ts` `flushOpenConnection`). A synchronous localStorage mirror is written on every edit (`rememberNotes`, L212). The veil's Reload awaits `flushNotes()` (`RestoringVeil.tsx` L22–24). Residual: the mirror stops silently for large note sets (S4-17) |
| S3-06 | Corrupt load → overwrite; no backup; no version | **PARTIAL** | Corrupt record → timestamped quarantine key, then delete (`quarantineValue`). A future version is held and never written (`heldIds`). A failed read → `unavailable`, not "no notes". **Gaps:** a corrupt index hides every note and leaves the records orphaned; there's no "one note couldn't be read" notice (S4-10) |
| S3-07 | Blocked storage → blank window; wrong messages | **PARTIAL** | Blocked → "Site data is blocked in this browser."; `AppHost.storageFor` is guarded (L9–33); the chunk failure is caught. **The common save path reports quota/abort as `unavailable`, shows "Notes could not be read. Nothing was overwritten." and makes Notes read-only for the session (S4-11)** |
| S3-08 | IME Esc blurs | **FIXED** | `decideKey(..., composing)`; `event.isComposing \|\| keyCode === 229` (`keyRoute.ts` L46–52; `InputManager.ts` L239–240) |
| S3-09 | Stuck drag/resize | **FIXED** | WindowFrame drag and resize end on `buttons===0`, pointercancel, lostpointercapture, Esc/Q, window blur and shell change |
| S3-10 | No re-clamp on resize | **FIXED** | `WindowLayer.tsx` resize listener → `fitRect` (`geometry.ts` L22–26) |
| S3-11 | Pointer-only focus model | **FIXED** | `FocusGuard` focusin → `focusAppWindow` (raise + `focusedId`) for keyboard and programmatic focus (L54–60). `closeWindow` skips minimized windows when it picks the next focus (`model.ts` L93–96). A title-bar drag focuses the article |
| S3-12 | Web tile exits SCREEN; card hidden | **PARTIAL** | A 500 ms guard on our own `window.open` (`InputManager.ts` L122–124, L284–287; Shelf L105; ExternalCard L47). **It covers only `blur`. A `_blank` open raises a foreground tab, so `visibilitychange` → `tabHidden` → RELEASED still happens (`shellMachine.ts` `reduceShell` 'tabHidden'; S4-06)** |
| S3-13 | Wind credit incomplete | **FIXED** | Author, Commons source link, licence link, list of modifications and the derivative's licence (`SettingsPanel.tsx` L185–199; `AUDIO_CREDITS.md` L20) |
| S3-14 | Beds retain media elements | **FIXED** | On stop and after each crossfade: `pause`, remove `src`, `load()`, disconnect source and fade (`engine.ts` L384–391, L416–420). Residual POLISH: the `elements` array grows by one per loop until `stop()` |
| S3-15 | GPU estimator covers only two buffers | **FIXED (estimator)** | Walks each pass for render targets and adds the shadow map (`gpuMemory.ts` L27–86; `QualityDirector.tsx` L107). Still an estimate: textures and geometry come from `renderer.info`. REG-S2-02 still needs the Task Manager |
| S3-16 | D-022 oscillation and ceiling rules | **PARTIAL** | D-031 limiter implemented (`autoQuality.ts` L68–73, L87, L90, L102). **The emergency condition and ceiling resets deviate (S4-07)** |
| S3-17 | M mutes in SCREEN | **DEFERRED-per-ruling (D-030), implemented** | Editable focus → no action (`keyRoute.ts`), so M types in text fields and mutes elsewhere. RUL-35b decides |
| S3-18 | Future-version backup can't fail loudly | **PARTIAL (suspected residual)** | `persist.ts` `set` returns `false` on failure, and `readPersistedSettings` keeps the original when the backup fails (`settingsModel.ts` L101, L108; test L76–90). But it then returns `null`, so the store runs on defaults, and **the first later settings write (the AUTO `remember` after 60 s, or any change) most likely replaces the original key**. Needs confirming against the zustand storage wrapper |
| S3-19 | Step-5/6 scope gaps | **PARTIAL** | Per D-030: `role="region"` + app-name label (`WindowFrame.tsx` L173), close fade 120 ms linear (overlay and world). Snap/F6/Worlds are absent (0.2). **SCR-08 per-app last position is lost on close (S4-05)** |
| S3-20 | Chunk failure → blank window | **FIXED** | `.catch` → "This app could not open." + Retry (`AppHost.tsx` L66–115) |
| S3-21 | Minimize unmounts the app | **NOT FIXED** | `WindowLayer.tsx` still filters minimized windows out. It's worse now: overlay↔spatial moves also remount (S4-13) |
| S3-22 | Removed EffectPasses never disposed | **PARTIAL** | `memo(PostStack)` stops rebuilds on unrelated re-renders. A tier change that keeps the composer (LOW↔MED, both SMAA, multisampling 0) still makes new children, and r3pp's cleanup only calls `removePass` |
| S3-23 | Safari Ogg/Opus | **NOT FIXED (non-gating)** | No AAC/MP4 alternate added |
| S3-24 | Chat tile says only "Chat" | **NOT FIXED** | Not touched in this PR |

**Tally:** 11 FIXED (S3-02, 03, 05, 08, 09, 10, 11, 13, 14, 15, 20). S3-02 is fixed in code only. 9 PARTIAL (S3-01, 04, 06, 07, 12, 16, 18, 19, 22). 3 NOT FIXED (S3-21, 23, 24; all POLISH or non-gating). 1 DEFERRED-per-ruling (S3-17). **0 REGRESSED.** Two gate items are still open under D-028: **S3-01 (via S4-01) and S3-04 (via S4-02).**

---

## Severity count (new S4 findings)

| Severity | Confirmed (code / numeric) | Suspected (needs a runtime check) | Total |
|---|---|---|---|
| BLOCKER | 2 | 0 | 2 |
| MAJOR | 2 | 0 | 2 |
| MINOR | 12 | 3 | 15 |
| POLISH | 5 | 1 | 6 |
| **Total** | 21 | 4 | **25** |

Suspected: S4-17, S4-18, S4-19, S4-24.

## The five most important items
1. **S4-02 (BLOCKER, D-028/RUL-34b): hand-back overwrite.** Tab A writes, B clicks "Use here" and types, then A clicks "Use here" again. A reloads its stale `memoryCache`, not IDB, and rewrites every record and the index. B's edits are overwritten and B's new notes drop out of the index. There's no warning.
2. **S4-01 (BLOCKER, D-028/MOV-18): residual rails.** A diagonal slide along the room-side glass stops dead at x 3.699 (the seam between the two closed-glass boxes at x 4). The back wall stops at x 1.551. A strafe 17 cm off the glass freezes at x 1.699 when yaw gives it a tiny +dz. Far narrower than S3-01, but MOV-18 says any rail is a BLOCKER.
3. **S4-03 (MAJOR): the 2 M limit drops the end of the note.** Typing or pasting in the middle of a full note keeps `text.slice(0, 2_000_000)`. The new text stays and the note's tail is silently cut.
4. **S4-04 (MAJOR): windows seen from behind are mirrored and clickable.** From the terrace, `hero-sea` faces into the room, so GP-11 sees mirrored text. Master queued this for step 8. I'd gate the step-8 merge on it.
5. **S4-05/S4-06 (MINOR, D-030 gate items).** The per-app rect is erased on close, so RUL-35c fails. The Web tile's foreground tab still drops SCREEN through `visibilitychange`, so RUL-35a fails.

---

## Confirmed findings, BLOCKER

### S4-01 · BLOCKER · Residual collision holds: glass seam at x ±4, back-wall seam at x ±1.55, near-corner strafe freeze at x ±1.7
- **Where:** `src/engine/player/collision.ts` `holdOpeningEdge` L71–107 (hold within the radius of an expanded corner when dz≠0). Test: `collision.test.ts` L175–218.
- **What:** the corner test fires at any expanded corner, including the inner corner where two coplanar boxes meet. Holding x there stops a slide that would be free without the hold. Numeric re-implementation, 1.35 m/s, dt 1/60:
  - (a) **Glass seam x = ±4.** `glass-closed-east` (x 2…4) and `glass-closed-east-outer` (x 4…6), both at z 4.47–4.53, give expanded corners at x 3.7/4.3. Sliding along the room face (z 4.169) with a forward diagonal stops at **x 3.699**. Examples: from (2.5, 4.0) at 60°, (2.5, 3.6) at 45°, (1.5, 3.5) at 45°. The same happens on the terrace face (z 4.831) with a backward diagonal, and mirrored on the west. This is the slide toward `hero-sea`.
  - (b) **Back-wall seam x = ±1.55.** Corridor wall (x 1.1…1.25) meets the back wall at z −3.2. From (3, −3.0) heading 240° it stops at **1.551**.
  - (c) **Near-corner strafe at x ±1.7.** From (1.0, 4.0) (capsule 17 cm off the glass line, not touching), heading 89.9° stops at **1.699**, while 90.1° is free. With a mouse, dz is never exactly 0, so it's a coin flip. This fails MOV-18 ("x never freezes at ±1.7 while not touching").
  - (d) Minor niche holds near the piers and rail-west (±6.3/6.64 at z 4.08/4.92).
- **Test gap:** "does not rail diagonal walks" skips every start within radius + step of a corner (`nearEdge`), exactly the cases above.
- **Builder claim:** the diagonal walk crossing x 1.7 and 3.7 is consistent with my sweep (open-room paths are free). It doesn't cover the seams.
- **Repro:** MOV-18 hook build. Teleport to (2.5, 1.62, 4.0), yaw so the heading is 60° (W), walk 3 s, log x every 100 ms: it plateaus at 3.699. Then (1.0, 1.62, 4.0) at yaw 89.9° vs 90.1° (hook yaw), D held. Then (3, 1.62, −3.0) at S+A.
- **Fix:** don't hold at an inner corner shared with a coplanar neighbour (merge coplanar boxes, or skip a corner when another box's expanded face continues it). Hold only while the capsule actually overlaps the face band. Drop the `nearEdge` exclusion from the test.
- **Owner:** Forge

### S4-02 · BLOCKER · Notes: taking the lock back in a former writer tab restores its stale cache and overwrites the other tab (S3-04 not closed)
- **Where:** `src/apps/notes/storage.ts` L469 (`loadNotes`: `if (memoryCache) return memoryCache`), L154–163 (a yield releases the lock but keeps `memoryCache` and `knownIds`), L291–299 (the writer puts every note and a new index). `Notes.tsx` L125–140 (`takeOver` → `loadNotes()` → `setNotes` → the save effect).
- **What:** the first take-over works, because a pure reader has `memoryCache === null` and reads IDB plus the mirror. A tab that was ever the writer keeps its cache after yielding. When it takes the lock back:
  - `loadNotes()` returns its old copy.
  - The `[notes]` effect writes the mirror and, after 300 ms, every record and the index from that copy.
  - The other tab's edits to shared notes are overwritten.
  - Notes it created vanish from the index. The records stay orphaned, so they're invisible.
  - The old copy's `updatedAt` is lower, but that doesn't help: `fresher()` isn't consulted on the cache path.
- **Repro:** RUL-34b(e)/(g):
  1. Tab A types "a1".
  2. Open tab B, click "Use here", create note "B1" and type in A's note "+b".
  3. In A click "Use here" and wait 1 s.
  4. Reload both. "B1" is gone and "+b" is gone.
- **Why BLOCKER:** RUL-34b says "any silent loss or overwrite = BLOCKER", and D-028 makes S3-04 a sign-off BLOCKER.
- **Fix:**
  - Clear `memoryCache` and `knownIds` when the role drops to reader. In `claimNotesHere`, always reload from IDB plus the mirror.
  - Make stale deletion index-based (read the current index in the same transaction) rather than based on `knownIds`.
  - Add a test: A writes, B takes over and writes, A takes back.
- **Owner:** Forge

## Confirmed findings, MAJOR

### S4-03 · MAJOR · The 2,000,000-character limit cuts the end of the note, not the extra text
- **Where:** `storage.ts` L29–30 (`text.slice(0, NOTES_MAX_CHARS)`), `Notes.tsx` L108–116.
- **What:** the limit is applied to the textarea's new value. Typing or pasting with the caret anywhere but the end keeps the inserted text and drops the note's last characters. Each keystroke at the limit deletes one character from the end. A mid-text paste of 100 k deletes the last 100 k of the existing note. The message "The rest of that paste didn't fit." says the opposite. D-029 says "only the extra text refused". The controlled value also moves the caret to the end.
- **Repro:** RUL-34c. Fill a note to exactly 2,000,000 chars ending in "END". Put the caret at position 10, type "Z" and reload. "END" is now "EN". Or paste 1,000 chars at position 10: the last 1,000 chars are gone.
- **Fix:** compute the insertion from `selectionStart/End` and the previous value, trim the inserted part only, restore the caret, and avoid splitting a surrogate pair (S4-22). Test a mid-text insert.
- **Owner:** Forge

### S4-04 · MAJOR · World windows seen from behind are mirrored, and still clickable and pickable
- **Where:** `WindowFrame.tsx` spatial branch L164–192 and `WindowLayer.tsx`: no `backface-visibility: hidden` and no back-plate. The crosshair window quad is DoubleSide (`WindowRig` `syncQuads`).
- **What:** `hero-sea` faces −Z (normal (−0.259, 0, −0.966)). From the terrace you see its back, and CSS 3D renders the DOM mirrored. In SCREEN the mirrored window takes clicks and typing, and E picks it up from behind. GP-11 requires it to "stay fully visible from the terrace through the glass", so visible is right and mirrored is wrong.
- **Repro:** pin Notes at `hero-sea`, walk to (5.1, 1.62, 6.5), turn to face −Z. The text reads right to left. Press Q and click it: the caret enters.
- **Severity note:** Master queued this for step 8. I'd grade it MAJOR under GP-11 and make it a condition for the step-8 merge. A back-plate (a card texture or a blank panel) with `backface-visibility: hidden` on the DOM is enough.
- **Owner:** Forge / Pixel

## Confirmed findings, MINOR

| ID | Finding | File:line | Repro / test-plan ID | Owner |
|---|---|---|---|---|
| S4-05 | **SCR-08 per-app rect is erased on close.** `fileFromWindows` rebuilds `rects` only from windows still in the store (`persistence.ts` L120–126). `close` deletes after 120 ms (`state/windows.ts` L51–54), and the subscription (`WindowRig.tsx` L137) rewrites the file without that app's rect. `openAppWindow` then finds nothing (`commands.ts` L20). Also, a pinned window restored after reload recalls to (48, 48), not its saved rect (`model.ts` L152) | `persistence.ts` L120–126; `state/windows.ts` L48–55 | RUL-35c: move Notes, close it and reopen: it comes back centred. D-030 makes SCR-08 an Alpha 0.1 item. Fix: merge into the stored `rects` instead of rebuilding | Forge |
| S4-06 | **Web tile still leaves SCREEN.** The 500 ms guard only skips `blur`. `window.open(_blank)` opens a foreground tab, the page becomes hidden, and `onVisibility` → `tabHidden` → RELEASED (the overlay layer hides, and the card with it) | `InputManager.ts` L284–287, `onVisibility`; `shellMachine.ts` 'tabHidden' | RUL-35a: click the Web tile, return after 2 s and after 2 min. Expect RELEASED and "Click to walk" instead of SCREEN with the card. Fix: apply the same window to `tabHidden` when leaving SCREEN, or keep SCREEN on `tabHidden` whenever the state is SCREEN (pointer lock isn't involved). The credits link in Settings has the same issue without the guard | Forge |
| S4-07 | **D-031 limiter deviations.** (1) `emergency = fps < 50% target && lowFor ≥ 3`, but `lowFor` counts time under **45** fps. So 40 fps followed by 29 fps for a moment demotes even with the budget spent. D-031 says below 50% **for 3 s**. (2) The session clock's ceiling is set once per `gl` (`QualityDirector.tsx` L34–51) and never reset on a manual change, so manual → AUTO keeps the old ceiling until reload. (3) Re-selecting AUTO keeps the persisted ceiling (`settings.ts` L50–53). (4) Emergency demotions count toward the 2 (`changes: [...changes, elapsed]`). The new test (`autoQuality.test.ts` L66–78) uses 10 fps, which can't tell the difference | `autoQuality.ts` L68–73 | RUL-36c: 40 fps until the budget is spent, then 29 fps for 2.5 s. Expect a wrongful demotion. RUL-36d: HIGH → AUTO in the same session; a climb past the old ceiling never happens. Open question 10: code answers "counts" and "no reset" | Forge / Atlas |
| S4-08 | **Placement never clamps the window's extent.** Aiming at the floor puts the centre 5 mm to 1.6 m along the ray. At pitch −70° the centre is 0.12 m above the floor with a half-height of 0.54 m, so most of the window sits under the floor. Wall pins near a corner or the ceiling poke through | `placement.ts` L217–290 | WIN-06 (floor, ceiling, inside corners) and RUL-23 (a tall window through the floor = MINOR) | Forge / Atlas |
| S4-09 | **Floats over the balustrade land over the sea.** On the terrace, aiming above the 1.05 m rail finds no hit, so the window floats 1.6 m ahead. From (0, 8.7) it lands at z ≈ 10.3, past the rail. `autoPinPlacement` has the same gap | `placement.ts` L274–290, L296–313 | RUL-25d ("never over the sea"), X-20 ("nothing pins where the player can't walk"), RUL-27g. Fix: clamp floats to the walkable volume (the zone bounds or the balustrade plane) | Forge / Atlas |
| S4-10 | **Quarantine gaps.** (1) A corrupt index is quarantined and `loadNotes` returns `[]`. Every note disappears from view: the records are intact but orphaned, and there's no rebuild from the `…:note:` records. (2) `LoadNotesResult` can't report "a note was quarantined", so the calm notice in RUL-34e is impossible. (3) Readers write during load (legacy migration, quarantine) | `storage.ts` L476–479, `quarantineValue`, `migrateLegacy` | RUL-34e (a–c) plus a corrupt-index case: set `ghiland:app:notes:index` to `"{"` and reload. Notes shows one empty note | Forge |
| S4-11 | **Save failures are reported as a read failure and lock Notes.** The kept-connection path maps every `tx.onerror`/`onabort` (quota included) to `'unavailable'` (L301–303). Notes then shows "Notes could not be read. Nothing was overwritten." and `problem` makes it read-only until reload (`Notes.tsx` L74). The `quota` message is reachable only on the rare fallback path | `storage.ts` L301–303; `Notes.tsx` L70–75, L149–152 | BRK-14 or a quota-fill hook: fill IDB, then type. Expect the read message and read-only mode | Forge / Pixel |
| S4-12 | **Windows-file guarding is incomplete (D-032 / BRK-13).** (1) The corrupt-blob backup ignores the guarded writer's `false`, and the original is removed even when the backup failed (L178–179). That's the S3-18 bug class, fixed for settings, not here. (2) One malformed pinned record is filtered out (L109) and gone for good at the next write, with no backup. That's a silent drop, which D-032 forbids. (3) `fileFromWindows` writes only live windows, and a world change closes other-world pins (`WindowRig.tsx` L170–177). The first world switch in 0.2 would erase them from storage. That isn't reachable in 0.1 (one world, no Worlds tile) but it's a design bug | `persistence.ts` L109, L120–140, L170–186 | RUL-37g: inject a malformed pinned entry next to a good one and reload. The bad entry disappears from storage after the first move. Quota-error injection: the corrupt key is removed without a backup | Forge |
| S4-13 | **Overlay↔spatial moves remount the app.** Overlay and spatial windows render under different parents (`WindowLayer.tsx`). Detach, pin-from-SCREEN, Q-recall and SCR-07 recall unmount and mount a new AppHost. Notes jumps to the **first note** (`setSelected(next[0])`, `Notes.tsx` L57), and preview, caret, selection and scroll are lost. The data itself survives (unmount save + memory cache) | `WindowLayer.tsx`; `Notes.tsx` L41–60 | GP-11 / WIN-05 "content unchanged". With 2 notes, edit note 2, drag to detach: note 1 shows. Fix: one keyed list with a CSS mode switch, or keep the selected id in the window instance | Forge |
| S4-14 | **No Web Locks → every tab is a writer.** `claimLock` returns `writer` when `navigator.locks` is missing (L167–169). That covers non-secure contexts (http on a LAN IP) and older Safari. D-029 names a BroadcastChannel fallback, and none exists | `storage.ts` L165–169 | RUL-34b(i) smoke on a browser or context without `navigator.locks` | Forge |
| S4-15 | **WIN-10: the caret doesn't land where clicked.** `focusPinnedFromWorld` focuses the first textarea/input in the window | `actions.ts` L160–170 | WIN-10: click the middle of a pinned note from WORLD; the caret goes to the start or the end | Forge |
| S4-16 | **Declared gaps that need a ruling.** A minimized pinned window disappears (no ~8 cm pin tag, WIN-12) but still holds its anchor, so RUL-24e shows a "taken" anchor with nothing there. No far card beyond 6 m (WIN-09, GP-11). No tray Recall/Show. KNOWN_ISSUES L8 declares all of these; D-030 doesn't cover them | `WindowLayer.tsx` (filters minimized); `KNOWN_ISSUES.md` L8 | RUL-24e, WIN-09, WIN-12 | Pixel / Master |

## Suspected findings, MINOR

| ID | Finding | File:line | Why suspected / runtime check | Owner |
|---|---|---|---|---|
| S4-17 | **localStorage mirror vs quota (X-16).** Every edit writes all notes to `ghiland:app:notes:flush` in one string, twice per keystroke (`update` and the `[notes]` effect both call `rememberNotes`). Rough quotas: Safari ≈ 2.5 M chars; Chrome and Firefox ≈ 5 M. (1) Past that, the mirror silently stops updating, and the flush protection falls back to IDB alone. (2) Near that, it fills the origin's quota, so `ghiland:windows` and settings writes fail (pinned windows not saved; only the Settings failure notice). (3) Stringifying 2–4 MB on the main thread per keystroke threatens key→glyph ≤ 50 ms at 1 M chars (RUL-34c) | `storage.ts` L212–223; `Notes.tsx` L64, L122 | Quota figures are per browser. Time key→glyph at 1 M and 2 M chars. Two 2 M notes in Safari, then pin a window and reload | Forge |
| S4-18 | **CanvasBoundary swallows any error while `lost`** and re-renders the same children. If something throws persistently during a loss, the boundary can't recover, and React passes the error up past it (a blank app, not the calm message) | `CanvasBoundary.tsx` L20–31 | Not reachable today, because the attribute fallback prevents the known throw. Check that no page error happens across RUL-28a/b | Forge |
| S4-19 | **`focus()` inside the overflow-hidden stage can scroll it.** Notes' `autoFocus` on a remount (pin from SCREEN) and `focusPinnedFromWorld` call `focus()` without `preventScroll`. If the target is partly outside the viewport, the browser may scroll the `window-stage` wrapper, offsetting every projected window from the world | `WindowLayer.tsx` stage; `Notes.tsx` L222; `actions.ts` L167 | WIN-20: after P in SCREEN and after clicking a pinned window near the screen edge, read `[data-testid=window-stage]` `scrollTop/scrollLeft`. They must stay 0 | Forge |

## POLISH

| ID | Status | Finding | File:line | Owner |
|---|---|---|---|---|
| S4-20 | Confirmed (numeric) | The carry spring (k 260, c 32, semi-implicit Euler, dt clamp 0.05) has an eigenvalue of −0.91 at 20 fps, so the carried window rings frame to frame at low fps. Fine at 30 fps and above | `carryPose.ts` L4–5, L57 | Forge |
| S4-21 | Confirmed | Wall pins sit 5 mm off the surface; WIN-06 says flat at 1 cm | `placement.ts` L13 | Forge |
| S4-22 | Confirmed | `slice(0, 2_000_000)` can store half a surrogate pair (RUL-34c) | `storage.ts` L30 | Forge |
| S4-23 | Confirmed | The SCR-07 recall arm never expires. After one pulse, a click hours later recalls with no pulse, and the arm survives pick-up and re-pin | `model.ts` L27, L44–59 | Forge |
| S4-24 | Suspected | A window straddling the camera plane (centre in front, a corner behind; carrying into a wall at 1.1 m) is only culled on its centre, so CSS perspective can fling the corners | `projector.ts` `projectWindow` | Forge |
| S4-25 | Confirmed | Hot-path work: the occlusion fade is exponential (τ 0.2 s, ≈ 0.6 s to 95%), sampled at 10 Hz, with no hysteresis. `syncQuads`, `occluders()` and the ghost's `resolvePlacement` allocate per frame. `persistWindows` writes localStorage on every store change, including each drag move | `WindowRig.tsx` L34–60, L137, L236–260 | Forge |

---

## Focus-area results

1. **Placement math and D-021.**
   - `resolvePlacement` order: ray ≤ 3 m against the placement set, then a free anchor within 1.5 m (of the hit or float point), then a pin surface (wall: hit + n·5 mm; up-normal: table pose), then float.
   - Glass float: `min(1.6, d − 0.3)`. Floor/placement float: `min(1.6, max(0.05, d − 0.005))`.
   - `withEyeCheck` makes any result < 0.7 m invalid, anchors included.
   - `rayAabb` normals face the ray. `quatFromNormal` = yaw(atan2(nx, nz)), consistent with D-023. Table-pose math checked (centre half·cos10° up, pushed back half·sin10°).
   - **Preview = pin:** `paintGhost` (`WindowRig.tsx` L63–99) and `pinWindow` (`actions.ts` L79–105) call `resolvePlacement` with identical colliders, anchors, occupancy (self excluded) and heightPx. The only difference is timing: the ghost uses this frame's camera and P uses the pose at key time, so they differ by at most one frame of motion. RUL-37f should pass within that.
   - Gaps: S4-08, S4-09, S4-21.
   - The table branch never runs in-world, because there are no desk or table colliders yet (step 8).
2. **D-023 anchor.**
   - `hero-sea` = (5.1, 1.45, 3.9), `yawQuat(−165)` = (0, −0.99144, 0, 0.13053). The normal is (−0.2588, 0, −0.9659) ✔ RUL-13/21.
   - The Notes pane (0.846 m) spans (4.69, 4.01)…(5.51, 3.79), clear of the glass (z 4.47) and the curtains (x 1.8–2.6) ✔.
   - It's the only anchor in `definition.ts`, so there's nothing else to compare with test-plan coordinates.
   - Snap check: aiming at the outer closed glass near x 5 hits z 4.47, 0.57 m from the anchor, so it snaps. Aiming at panel x 2…4 centred at x 3 is 2.18 m away, so it floats (RUL-13c ✔ statically).
3. **D-032 ray sets.**
   - `raySets.ts`: placement = movement ∪ placement ✔; occlusion = occluder ✔; **crosshair = occluder only ✔**. `SceneManager.tsx` L40 registers the crosshair set, and window quads are added via `setWindowQuads`, with a 25 m cap.
   - **Placement boxes (floors, ceilings, deck) no longer stop the crosshair, which matches the canonical D-032 text. There's no finding. Open question 9 is resolved in code.**
   - Layers: walls = movement + occluder + pinSurface; glass = movement; floors/ceilings/deck = placement; soffit and curtains = `[]` and not in `seasideColliders`, so they're in no set.
   - RUL-37: the soffit is **not** a placement collider. Furniture, planter and tables don't exist yet.
4. **Anchor occupancy.**
   - Derived from open worldPinned windows with an `anchorId`, self excluded (`actions.ts` L26–33) ✔.
   - Pick-up (→ detached) and close free the anchor. Close frees it after the 120 ms fade.
   - Minimized pinned windows still occupy it (RUL-24e ✔, but see S4-16).
   - Reload: occupancy comes from the persisted `anchorId` ✔. `restorePinned` dedupes per app, not per anchor (harmless while pins can't collide).
5. **`migrateWindows` / persistence.**
   - Versioned envelope `{state, version: 1}` under `ghiland:windows`, written through the guarded `localStorageAdapter` ✔.
   - v0 list → pinned records, and a carried pose becomes an overlay rect ✔.
   - A future version is read in memory with `writesHeld`, so it's never written over ✔. Corrupt → `…:corrupt-<ts>` ✔.
   - Gaps: S4-05 and S4-12.
6. **S3-01 numeric re-check.** See S4-01. There are no new movement colliders in step 7.
7. **S3-02 freeze-on-loss path.**
   - No CanvasRoot re-render. PostStack is frozen by memo and a held profile. `apply()` and the timers skip while lost. The attribute fallback makes the `alpha` read safe.
   - On restore: key bump → a new composer. The old one's targets are released by `ComposerLifecycle` cleanup.
   - `frameloop` stays `always` during a loss. three's `render()` returns early on a lost context, so it's safe but spends CPU. WindowRig clears the transforms on loss, and the next frame rewrites them, so the clear does nothing.
   - D-017 auto-pin runs via `loseContext` → `apply(blur)` → hook, using the spring's pose ✔.
   - `pointerLockElement` is cleared three ways.
   - Leaks across repeated losses: each restore builds one composer and releases the old targets. The EffectPasses of the old composer go with the context. Nothing grows per cycle that I can see.
   - Runtime: RUL-28a.
8. **D-029 Notes.**
   - ✔ Per-note records with `version` + `updatedAt`, and the index is written in the same transaction.
   - ✔ 2 M limit with an 80% warning, but S4-03 and S4-22.
   - ✔ Flush on pagehide, visibilitychange and before Reload, with a synchronous mirror (S3-05).
   - ✔ Single writer via Web Locks with a BroadcastChannel yield. The read-only banner and "Use here" work for the first take-over.
   - ✘ Hand-back (S4-02) and the no-locks fallback (S4-14).
   - Remount: the same tab stays writer (`releaseHold` check) and loads from the memory cache ✔, but the selected note resets (S4-13).
   - Quarantine and version: S4-10. Blocked storage: calm message ✔. Save errors: S4-11.
   - The mirror at 2 M chars: one 2 M note (4 MB of UTF-16) fits Chrome/Firefox's ≈ 5 M-char quota and roughly fills Safari's. Several large notes silently stop the mirror (S4-17). When the mirror write fails, the old mirror stays with older stamps, so `fresher()` correctly prefers IDB.
   - Cross-tab race at hand-over: A's pending debounce is dropped as `readonly`, but its last keystrokes are already in the mirror (written synchronously), and B's `loadNotes` prefers the newer mirror. So RUL-34b(c) should pass for small notes. It fails once the mirror is over quota.
9. **DOM/WebGL swim and backface.**
   - The projector writes the stage and each window's `matrix3d` at frame priority 0, after the camera (−1) and before the composer (1), from the same camera. There's no structural one-frame lag. Conventions match CSS3DRenderer (`projector.ts`).
   - Compositor desync is still possible, so WIN-20 needs 240 fps video.
   - Backface: S4-04, MAJOR.
   - Straddling: S4-24.
- **SCR-07.** First open of a pinned app → `pulseWindow` (600 ms outline) and arms recall. The second open → overlay at `lastScreenRect`, raised ✔ (`model.ts` L44–59; test "pulses a pinned app, then recalls it"). Nits: S4-23. A pulse on a window behind the camera is invisible.
- **WIN-14 teardown.**
  - DOM nodes leave with React.
  - `domRegistry` binds and unbinds through ref callbacks.
  - Occlusion entries are dropped for dead ids.
  - There are no CSS3DObjects or textures to dispose (custom projector, and no far card yet).
  - Close fade: 120 ms linear on opacity for overlay and world windows, with no scale overshoot (only `scale(0.96)` while lifted) ✔ RUL-35e statically.
  - Carry springs are cleared on the overlay transition. A closed carried window can't happen, because carry exists only in WORLD, where × isn't clickable.
- **S3-09 / S3-11 with drag-to-detach.**
  - The detach gesture (pointer at the viewport edge ≥ 300 ms, then release) goes through the same cleanup, so a lost capture or a blur cancels it ✔.
  - `presentWorld` asks for pointer lock from `pointerup`. That's inside the pointerdown's transient activation only if the drag lasts < ~5 s. **Runtime check:** a 6 s edge hold, then release, should either lock or show "Click to walk" cleanly.
  - The remount's `autoFocus` is undone by WindowLayer's blur-on-leaving-SCREEN effect, which runs after the commit, so WASD isn't captured in WORLD ✔ (checked in code).
- **D-030.** `role="region"` + labels ✔; close fade ✔; M rule ✔; Web tile S4-06; SCR-08 S4-05. RUL-35f: F6 isn't bound, so nothing happens.
- **D-031.** S4-07. Open question 10, answered by the code: an emergency demotion counts toward the 2, and re-selecting AUTO does not reset the ceiling.
- **S3-13.** Wording complete (see table).
- **Bundle size vs budgets.** Not derivable. No build was run and the PR body's numbers are behind a login. The new modules are small TypeScript with no new dependencies.
- **Test coverage of the new code.** New or extended tests cover:
  - placement (174 lines), persistence (109), actions (80; auto-pin), model (62; pulse/recall), collision (93), raySets, projector, exposure, CanvasBoundary, settings backup, and the autoQuality limiter.

  **No tests for:**
  - the two-tab hand-back (S4-02);
  - mid-text limit inserts (S4-03);
  - rects after close (S4-05);
  - the corrupt index;
  - `tabHidden` after `window.open`;
  - the emergency 50%-for-3-s boundary;
  - FrozenPost/ContextGuard behaviour;
  - WindowRig occlusion and projection in a DOM test;
  - drag-to-detach.

  The collision test's `nearEdge` exclusion hides S4-01.
- **D-027.** `sunDirection(12, −22)` = (−0.366, 0.208, 0.907) ✔. Exposure: corridor 1.2, interior 1.0 → 0.9 facing the glass (`forward.z`), terrace 0.9, damped with τ 1.5 s (`exposure.ts`). The soffit and curtains are visual only.

## Builder claims
| Claim | Verdict |
|---|---|
| A diagonal walk crossed x 1.7 and x 3.7 and pinned at `hero-sea` | Consistent with my sweep for open-room paths. It doesn't cover the seams and near-corner cases in S4-01 |
| Three context losses pinned and three carrying: lock null, canvas connected, mount count 1, no 'alpha' error, walkable, carried window auto-pinned | Consistent with the code (no re-render, frozen post, attribute fallback, triple exit, hook). Not verified at runtime |
| A note refreshed 1 ms after typing survived | Consistent: synchronous mirror on every keystroke, newer copy wins |
| A 1,000,000-char note survived reload | Consistent: the 2 MB mirror fits, and IDB has it too |
| Two tabs: the second is read-only and "Use here" works | True for the **first** take-over. **Taking the lock back loses data (S4-02)** |

## Sentinel runtime-check list for the QA runner (prod build, hooks where named, on `675a9f5`)
1. **MOV-18 plus the S4-01 repros:**
   - (2.5, 4.0) at 60° and (1.5, 3.5) at 45° → x must pass 3.7.
   - The terrace face with S+A/S+D at x ±4.
   - (3, −3.0) at 240° → must pass 1.55.
   - (1.0, 4.0) strafe at yaw 89.9° vs 90.1° → must pass 1.7.
   - Log the contact collider every 100 ms.
2. **RUL-34b(e/g), the hand-back:** A → B "Use here" → create "B1" → A "Use here" → reload both. Expected to fail (S4-02). Also (c) with a ≥ 3 M-char note set (mirror over quota).
3. **RUL-34c mid-text:** 2,000,000 chars ending "END", type at position 10 → check the tail (S4-03). Surrogate at the limit (S4-22). Key→glyph at 1 M and 2 M chars (S4-17).
4. **RUL-34d:** all six paths × 10. RUL-34e plus a corrupt **index** (S4-10). A quota-fill save (S4-11).
5. **RUL-35a** with a real foreground tab: log `visibilitychange`, `blur` and `shellState` (S4-06). **RUL-35c** close/reopen and reload (S4-05). RUL-35e 240 fps close fade.
6. **RUL-28a/b** with the D-028 logging. Also `renderer.info.programs`, textures and heap after each of 3 cycles, and confirm no page error during the loss while the frameloop runs.
7. **RUL-36c:** a 40 fps pre-roll, then 29 fps for 2.5 s with the budget spent (expect a wrongful demotion). **RUL-36d:** HIGH → AUTO in the same session; watch for a climb past the old ceiling (S4-07).
8. **GP-11 / S4-04:** view `hero-sea` from (5.1, 1.62, 6.5) → mirrored? Click through from behind in SCREEN; E from behind.
9. **WIN-20:** 240 fps flick video. Also read `window-stage` `scrollTop/scrollLeft` after P in SCREEN and after clicking a pinned window near the screen edge (S4-19).
10. **RUL-25d:** terrace (0, 8.7), pitch +5° over the rail, P → window z > 9 = fail (S4-09). **WIN-06:** floor at pitch −70° (S4-08). RUL-27g: auto-pin over the rail.
11. **RUL-37 a–g** membership dump. Expect: crosshair = occluders + quads (no floors); the soffit in no set. (g) a malformed pinned entry next to a good one, plus a `setItem` quota error during the corrupt backup (S4-12).
12. **RUL-24 a–e:** (e) minimize → nothing visible, the anchor still taken (S4-16). **SCR-07:** pulse, then a second click; then one click, wait 10 min, click (S4-23). **WIN-10** caret position (S4-15).
13. **Detach:** drag Notes to the top edge for 300 ms and release → carried and walkable (WASD not typed into Notes). Repeat with a 6 s hold (transient activation). With 2 notes, check which note shows after detach (S4-13).
14. **Carry at 20 fps** (6× CPU throttle): look for frame-to-frame jitter (S4-20).
15. **REG S3-22:** switch LOW↔MED 10× and watch the program/material count. **D-027:** read `gl.toneMappingExposure` in the corridor (≈ 1.2) and facing the glass (≈ 0.9), and check the image responds (AgX pass).

## What's done well
- The S3-02 fix is thorough: three independent layers (no re-render, frozen post stack, attribute fallback), each aimed at the root cause I found, plus a sensible restore path.
- The ray sets are separate, named and tested. The crosshair set matches canonical D-032. The soffit and curtains are correctly out of every set.
- The preview and the pin share one `resolvePlacement` with identical inputs. D-021 applies to every branch, and anchor occupancy is derived rather than stored.
- The Notes storage redesign is serious work: per-note records, the index in the same transaction, a kept connection so pagehide flushes start synchronously, a synchronous mirror with newer-wins, timestamped quarantine keys, and held future versions. It keeps the lock across a same-tab remount.
- `migrateWindows` handles v0, future and corrupt files through the guarded writer, and a future file is never rewritten.
- The S3-13 credit is now complete. S3-08, S3-09, S3-10, S3-11 and S3-20 are clean, small fixes. The audio element retention is fixed properly.
- D-023 is honoured exactly. D-027's sun vector matches to 3 decimals. The projector follows CSS3DRenderer conventions in one frame slot.
- KNOWN_ISSUES is candid about the missing pin tag, far card and reticle, and its context-loss explanation is now correct.

---

## SUMMARY
PR #4 lands step 7 (carry, pin, placement, occlusion fade, world persistence) and most of the S3 fixes.
- **S3 status:** 11 FIXED (S3-02 in code only), 9 PARTIAL, 3 NOT FIXED (POLISH or non-gating), 1 DEFERRED-per-ruling, 0 REGRESSED.
- **New:** 25 findings: **2 BLOCKER, 2 MAJOR**, 15 MINOR, 6 POLISH (4 suspected).
- **The BLOCKERs are the two remaining D-028 gate items:**
  - S4-02: a Notes tab that takes the lock back overwrites the other tab's work (S3-04 not closed).
  - S4-01: residual collision holds at the glass seam x ±4, the back-wall seam x ±1.55, and a near-corner strafe freeze at x ±1.7 (MOV-18).
- **The MAJORs:**
  - S4-03: the 2 M limit cuts the end of a note on a mid-text insert.
  - S4-04: mirrored, interactive window backs from the terrace (GP-11).
- **Resolved in code:**
  - S3-02: fixed in code.
  - D-032 crosshair: correct (open question 9 resolved in code).
  - D-021 preview and pin: consistent.
  - D-023: verified numerically.

## WHAT WAS DONE
- Read the PR #4 metadata, the file list and every patch (64 files) through the cursor-github connector. Read nine files in full at `675a9f5` and checked they match the patches.
- Re-read on the box: `DECISIONS.md` D-028…D-032, test plan v0.5 (MOV-18, RUL-13/21/23/24/25/27/28/32–37, WIN-05/06/09/10/12/14/20, SCR-07/08/10, GP-11, BRK-13, open questions 9 and 10), and my PR #3 review.
- Ran throwaway numeric checks in `/tmp/sentinel-pr4`: a collision re-implementation and sweeps, placement geometry, the D-023 normal and pane, and the spring eigenvalues. The folder is deleted.
- Wrote this file. Nothing was posted to or changed on GitHub.

## FILES / SYSTEMS AFFECTED
- **Created:** `docs/qa/REVIEW_PR4_STEP_7.md` (box, `/workspace/ghiland`). No other file was created or changed.
- **Systems reviewed:**
  - `engine/windows/*` (WindowRig, actions, placement, projector, raySets, carryPose, crosshair, domRegistry, bridge)
  - `shell/windows/*` (WindowLayer, WindowFrame, AppHost, FocusGuard, model, persistence, commands, geometry, pulse), `state/windows.ts`
  - `apps/notes/{storage,Notes}`
  - `engine/input/{InputManager,keyRoute,shellMachine}`
  - `engine/quality/{ContextGuard,QualityDirector,autoQuality,gpuMemory}`, `engine/canvas/CanvasRoot`, `shell/CanvasBoundary`, `shell/screen/{RestoringVeil,SettingsPanel}`
  - `engine/player/collision`, `engine/environment/*`, `engine/audio/engine`
  - `state/{settings,settingsModel,persist}`, `worlds/seaside-house/{definition,level,sun}`
  - `docs/{KNOWN_ISSUES,AUDIO_CREDITS}`

## IMPORTANT DECISIONS
- **S4-01 is a BLOCKER**, even though it's far narrower than S3-01. MOV-18 and D-028 say "any rail = BLOCKER", and (a) sits on the slide toward `hero-sea`. Master may choose to treat (d) as niche.
- **S4-02 is a BLOCKER** under RUL-34b ("any silent loss or overwrite") and the D-028 S3-04 override. The repro is a normal multi-tab habit, not an injection.
- **S4-04 is MAJOR despite the step-8 deferral.** GP-11 explicitly covers the terrace view. I'm not overriding Master's scheduling, only recommending it gate the step-8 merge.
- **D-032 crosshair: no finding.** Judged against the canonical text (occluders + window quads, no placement boxes). The code matches.
- **S3-17 is DEFERRED-per-ruling (D-030).** S3-12 is PARTIAL rather than FIXED because the common path (a foreground tab) still fails.
- **S3-18 is PARTIAL on a suspected residual.** Labelled suspected until someone checks zustand's write-after-null behaviour.

## RISKS
- **Step 8 adds furniture, planter and table colliders.** Every new box adds expanded corners and coplanar seams, which is exactly where S4-01 lives, and the `nearEdge` test exclusion will hide them. The planter at (−2.9, 0, −2.6) and the tables near walls also exercise the table pose and S4-08 for the first time.
- **Notes S4-02 will surface with the first two-tab user.** Fix it before any further persistence work.
- **The mirror and the windows/settings files share the localStorage quota (S4-17).** Big notes can silently stop window persistence.
- **Far cards and pin tags (WIN-09/12) will add the first per-window GPU textures.** WIN-14 teardown and the context-loss rebuild become real then.
- **The curtain cloth and soffit art must stay out of every ray set.** Today they're `[]` by construction.
- **Per-frame allocations and exponential fades (S4-25)** will add up with the art pass. The D-031 emergency path (S4-07) may then demote too eagerly.

## KNOWN LIMITATIONS
- Nothing was run in a browser. Every item is marked confirmed (code, library behaviour or numeric re-implementation) or suspected.
- S4-01 comes from a faithful JS re-implementation of `collision.ts` at `675a9f5`, not from the app. Confirm with the MOV-18 hook walk.
- Browser behaviours are from platform knowledge, not a device test: `window.open` foreground tab → `visibilitychange`; localStorage quotas; transient activation for pointer lock; focus-scroll in overflow-hidden containers.
- Not checked in depth:
  - `bridge.ts`, `domRegistry.ts`, `crosshair.ts` internals beyond the set registration.
  - `Scene.tsx`'s visual meshes.
  - `frameOrder.ts` beyond the priority constants.
  - Chat's pending reply timer (S3-21 residual).
  - The AURA_WORLDS and test-plan doc diffs.
- Blob SHAs weren't compared file by file. Nine full files matched the patches.
- Bundle size wasn't derivable. The PR artefacts are behind a login.

## RECOMMENDED NEXT ACTION
1. **Forge, a fix PR before step 8 merges:**
   - S4-02: clear the cache and `knownIds` on yield, reload from IDB plus the mirror on every claim, index-based deletes, and a hand-back test.
   - S4-01: coplanar-seam and inner-corner fix; remove `nearEdge` from the test.
   - S4-03 (+ S4-22): selection-aware limit.
   - S4-05: merge rects.
   - S4-06: `tabHidden` guard.
   - S4-10/11/12: quarantine notice, index rebuild, error mapping, guarded backup, no silent drop.
2. **Forge / Pixel:** S4-04 back-plate + `backface-visibility`, as a condition of the step-8 merge. S4-13: keep one mounted AppHost across modes.
3. **Atlas / Master:**
   - Rule on the S4-07 semantics (open question 10, answered by the code as "counts" and "no reset"; confirm or change).
   - S4-09: walkable-volume clamp for floats.
   - The S4-16 declared gaps (pin tag, far card).
   - Whether S4-04 gates step 8.
4. **Sentinel:** run the 15-item runtime list above on the prod build of `675a9f5` (§8 entry criterion), starting with MOV-18, RUL-34b, RUL-28a–b, RUL-35a/c and RUL-36.
