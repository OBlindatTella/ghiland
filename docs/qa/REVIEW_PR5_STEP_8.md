# Sentinel review: PR #5, step 8 (art pass) + S4 fixes + addendum

| | |
|---|---|
| PR | OBlindatTella/ghiland #5, "Seaside art pass: sky, ocean, and furnished rooms" (draft, open) |
| Branch | `cursor/seaside-art-pass-7254` |
| **Reviewed head (pinned)** | **`f5cc906c682e5a485bddf65d193502ef9a8e6608`** (last push 06:42 CEST; re-checked at 06:58 CEST, unchanged) |
| Base | `675a9f5` (32 commits, 82 files, +4400/−440) |
| Reviewer | Sentinel. Same method and rules as REVIEW_PR4_STEP_7.md |
| Date | 2026-09-29, 06:47–07:05 CEST |
| Method | Remote read via the cursor-github connector only (PR file list with patches, `get_file_contents` at the pinned SHA). No clone, no raw curl, no browser, nothing posted to GitHub. Collision re-implemented numerically (exact JS port of head `collision.ts` plus every `level.ts` and `furniture.ts` movement box). three.js and web-platform behaviour checked against library source and specs. Scratch dir deleted at the end |
| Inputs | Box `docs/DECISIONS.md` (D-001…D-035), box `docs/qa/ALPHA_0.1_TEST_PLAN.md` (v0.6 already on the box, which includes RUL-34f/g, RUL-38, RUL-39), `REVIEW_PR4_STEP_7.md`, `RUNTIME_QA_675a9f5.md`, and the PR's `docs/TEST_HOOKS.md`, `docs/KNOWN_ISSUES.md` and `docs/ASSET_CREDITS.md` |

Labels: **confirmed** means shown by code reading, library or spec text, or a numeric re-implementation, and the kind is named on each finding. **suspected** means it needs a runtime run to prove. Line numbers are new-file lines at `f5cc906`.

---

## GATE VERDICT

**Can PR #5 merge? NO.**

Blocking items (all must be fixed, then re-reviewed):

1. **S5-01 (BLOCKER, S4-01 residual, D-033 gate).** A new release-caused dead stop at the dining-table / west-wall junction. This is the same mechanism as S4-01. S4-01 therefore stays **PARTIAL**, and S3-01 stays open.
2. **S5-03 (BLOCKER).** Editing a note longer than 8,000 characters through the new window breaks basic editing:
   - Enter inserts nothing.
   - Undo and redo are disabled.
   - IME composition is double-inserted.
   - Ctrl+Delete deletes backwards.
   - Most of a 1 MB note can't be reached.
   - Select-all, copy and find only see the 8,000-character slice.

   This is a regression that PR #5 introduced, and it fails DES-08 and RUL-34g.
3. **S5-04 (BLOCKER under the test plan's own rule; Master can re-rate this via open question 11).** Notes over 200k characters have no mirror. A dirty set over 200k removes the mirror for small notes too. The pagehide IDB flush now sends its `put`s only after an async index read. The 300 ms debounce restarts on every key.
   - Result: F5, a tab close, a crash or a "Use here" hand-back while typing into a large note can lose more than the last 300 ms. RUL-34d/f call that a BLOCKER.
   - Even if Master accepts a size exception, the get-before-put change in `flushOpenConnection` must be reverted. It weakens the pagehide flush for every size and is only masked by the mirror.
4. **S5-06 (MAJOR, S4-04 residual; S4-04 gates the merge per D-033).** Nothing blocks keyboard input into a window seen from behind. There is no `inert` or `tabIndex` change, and FocusGuard's Tab cycle includes windows facing away. Fix it, or show at runtime (RUL-38) that Tab can't reach a window facing away. S4-04 stays PARTIAL until then.

Strongly recommended in the same fix round (not gating by ruling, but both are regressions or comfort failures on the main path):

- **S5-05 (MAJOR):** placement clamping pulls free wall pins on the two long side walls 0.44 m off the wall and ignores the window's yaw and interior walls. D-035 S4-08 isn't met.
- **S5-02 (MAJOR):** the corner release teleports the player up to 0.28 m in one frame against the stick, at every free-standing corner and at the opening edges. The fix for S5-01 is in the same function.

Must be verified at runtime on real hardware (an RTX 3060-class desktop, headed Chrome, a real desktop session) before sign-off:

- MOV-18: the full start grid, including the S5-01 and S5-02 spots and the furniture seams.
- RUL-34d, RUL-34f (all sizes) and RUL-34g.
- RUL-38: the back plate, E, clicks and Tab from behind, and E from the terrace.
- RUL-39a–d.
- PERF-01 / D-015 on HIGH at 1080p, DPR 1. Then GPU memory at DPR 1, 1.25, 1.5 and 2.
- RUL-28a/b with a screenshot before and after restore (S5-09).
- REG-RT-01/02 (N1/N2).
- RUL-36 with `setFakeFps`, after S5-08 is fixed or checked.

The full list is in the runtime-check section.

---

## Master's five questions

### Q1. New furniture, planter and table colliders vs S4-01

**Verdict: the S4-01 seams are fixed, but one new dead stop (S5-01) and a widespread snap (S5-02) remain. The builder's grid test no longer excludes near-edge starts, but it only checks the old rail x values, so it can't see new junctions.**

- **Old seams, re-run numerically at head (confirmed):**
  - Glass 60° from (2.5, 4.0) reaches x 5.699; 45° from (1.5, 3.5) reaches 5.318.
  - Terrace-face backward diagonals: 120° reaches 5.699 and 240° reaches 1.426.
  - Back wall 240° from (3, −3.0) reaches −0.779.
  - The 89.9° / 90.1° strafes at z 4.0 run through x 1.7 to the east wall (6.699).
  - V2 at 30° reaches the glass at (5.4, 4.17).
  - `faceContinuesPast` (FACE_EPS 0.02) correctly suppresses the release where a coplanar neighbour continues the face. The retry is only accepted if it gains Z (`collision.ts` L68–L131, L188–L200).
- **Full sweep (confirmed numerically):** 3,482 starts on a 5 cm grid over the house and terrace, including near-corner starts at every collider corner, × 120 headings × 2 s at 1.35 m/s.
  - The only release-caused dead stops are **76 cases at the dining-table / living-west junction (S5-01)**.
  - Every other stop is a genuine inner corner (table–wall, stool–island and similar nooks where a plain slide also stops).
- **Snaps (S5-02, confirmed numerically):** 1,470 single-frame x jumps against the input of more than 2 cm, up to **0.281 m in one frame**, across 17 boxes. Every free-standing piece is affected, plus the pier, glass-opening and corridor-mouth corners.
- **MOV-18 real-input walk:** the direct V2 → hero-stance heading (43.3°) now runs along the sofa / coffee-table / lamp cluster. A constant heading reaches the stance only for 46°–60.5° from V2 (5.7–7.4 s) and 46°–54° from spawn (11.3–12.9 s). This isn't a defect, but the test plan should say it (S5-18).
- **Narrow slots:** config-space gaps of stools–table 0.22 m, table–reading chair 0.17 m and chair–glass 0.09 m. These are legitimate, but the runtime pass should try them.
- **Builder test (confirmed, code):** `collision.test.ts` L195–L197 dropped the `nearEdge` exclusion.
  - The rail check still compares against the pre-listed rail x values only.
  - The new named seam tests (L218–L245) cover the old seams.
  - The furniture tests (L258–L286) test each piece **in isolation** (`[piece]`), so no wall–furniture or furniture–furniture junction is ever exercised.
  - Corners aren't skipped any more, but junctions aren't tested.
- **Table pose (confirmed, code, `placement.ts` L249–L275 and `containPlacement` L313–L337):**
  - **Top normal:** the slab test returns +Y for top entries. `hit.normal[1] > 0.7` selects the table pose. Only `pinSurface` tables qualify (coffee, island, dining, desk). OK.
  - **Clearance:** the bottom edge sits exactly on the top, 0 cm (`hit.point[1] + half·cos10°` minus `half·cos10°`). D-035's 2 cm rule is written for floors and ceilings, so this isn't a strict violation. The z-fight risk is nil (the DOM sits over the canvas), but it is 0 cm, not 2 cm (S5-13).
  - **Edge overhang:** nothing keeps the window's width over the top. A 440 px window is 0.846 m wide. Near an end of the 1.5 m coffee table it overhangs by up to 0.42 m, and past a corner of any table it overhangs in both directions (S5-13).
  - **Tilt:** the top leans 0.19 m back (560 px). On the desk against the east wall, the X clamp (S5-05) then pulls the whole window 0.24 m into the room.
  - **Side faces:** table sides are pin surfaces. Aiming at a side gives an upright window 1 cm in front of the table, lifted so its bottom is 2 cm off the floor. That's acceptable but odd (S5-13).

### Q2. Notes over 8,000 characters edited through an 8,000-character textarea window

**Verdict: not acceptable for 0.1. BLOCKER (S5-03), a regression that PR #5 introduced.** Before PR #5, notes up to 2M characters were natively editable, just slow at 1M+ on SwiftShader. Now any note over 8,000 characters (about four pages) loses basic editing. DES-08 (1 MB notes work) and RUL-34g fail by construction. Everything below is confirmed from code (`Notes.tsx` L153–L158, L188–L243, L423–L471; `bodyWindow.ts` L4–L61) plus the Input Events spec:

| Aspect | Finding |
|---|---|
| **Enter / new line** | For textareas, `beforeinput` for Enter is `insertLineBreak` with `data = null`. The handler uses `event.data ?? ''` (L204), so `applyTextEdit(…, '')` is a no-op and the event is `preventDefault`ed. **Enter inserts nothing** in a long note. With a selection, Enter deletes the selection and adds no newline. |
| **Undo / redo** | `historyUndo` and `historyRedo` hit `if (!inserting && !deleting) { preventDefault; return }` (L221–L224). Every edit also replaces `field.value` programmatically, which clears the browser's undo stack. **No undo at all** for long notes, so select-all + one key loses 8,000 characters irrecoverably. |
| **IME** | Chrome's `insertCompositionText` beforeinput is not cancelable. The handler still applies `event.data` (the whole composition string so far) to the model on every update and then rewrites `field.value` mid-composition, which ends it. Result: doubled or garbled CJK text (for example "n"+"ni"+"nih"…), and the composition is cut at the first update. At the window boundary, it's the same plus the re-centre. |
| **Ctrl+Backspace / Ctrl+Delete** | Every `delete*` type except `deleteContentForward` is treated as "one character backward" (L228). `deleteWordBackward` deletes one character. **`deleteWordForward` and `deleteSoftLineForward` delete the character before the caret** (the wrong direction). |
| **Select-all / copy / cut** | Ctrl+A selects the 8,000-character slice only. Copy and cut take only the slice (the clipboard is short, with no warning). Select-all + type replaces only the slice. |
| **Find (Ctrl+F)** | Browser find only sees the slice. The rest of a 1 MB note is findable only in Preview (the full markdown render). There's no in-app find. |
| **Navigation** | Only Ctrl+Home/End jump (L429–L431). ArrowLeft/Right at the exact slice edge shift one character per key (L432–L443). Up/Down, PageUp/PageDown, mouse wheel, scrollbar and drag-select stop at the slice edge. The middle of a 1 MB note is reachable only one character per key-repeat (hours). |
| **Caret / scroll jumps** | `paintBody` re-centres the slice on the caret after every edit (anchor = caret − 4,000, or len − 8,000 at the end), so the slice start moves by one character per keystroke, even when appending. The slice starts mid-line, so every soft wrap above the caret re-flows each key. `scrollTop` isn't preserved, and the view jitters (visual effect suspected, mechanism confirmed). |
| **Paste across the boundary** | Chrome fills `data` for textarea `insertFromPaste`, so paste lands at the right full-string offset and the 2M clip works (`applyTextEdit`, surrogate-safe). But a selection can never span the boundary, so "replace this region" is impossible past 8,000 characters. |
| **Screen readers** | The accessibility tree exposes only the slice. Its value changes on every key and a re-centre looks like new content, so line and paragraph navigation stops at the slice edge (suspected; needs NVDA/VoiceOver). |
| **Splice integrity** | `anchorRef` and `field.value` are only updated together in `paintBody`. Cancelable insert and delete types splice correctly (`applyTextEdit` and `deleteText` are correct, surrogate-safe and tested). Integrity breaks where the browser edits natively and the handler also edits: IME (above) and the wrong-direction word deletes. `onChange` ignores slice-sized values for long notes (L468), so no double apply there. |

What 0.1 can accept (for Atlas and Pixel to choose):

- (a) Revert to a native full textarea up to a much higher threshold (for example 200k–500k), measure key→glyph on the gating machine, and ask Master to relax "≤ 50 ms at 2M" to a size the native control meets.
- (b) Keep windowing only above that threshold, but:
  - line-align the window;
  - handle `insertLineBreak`/`insertParagraph` (insert "\n");
  - let composition run natively and apply on `compositionend`;
  - map every `delete*` type to its real range (`getTargetRanges()`);
  - keep a model-side undo stack;
  - page the window on Up/Down/PageUp/PageDown/wheel;
  - make Select-all and Copy act on the full note.

(b) is too much for a follow-up. (a) is the realistic 0.1 path.

### Q3. The mirror skips notes over 200k characters

**Verdict: this doesn't fit D-035 (no size exception, per test plan v0.6 RUL-34f(g) and question 11). The real loss window is unbounded while typing continuously, and the pagehide flush got weaker. Severity: BLOCKER by RUL-34d/f's rule ("content lost beyond the last 300 ms = BLOCKER"). It drops to MAJOR only if Master rules a size exception and the flush regression is fixed (S5-04).** All confirmed from code:

- **The cap is total, not per note.** `writeMirror` (storage.ts L397–L420) sums **all dirty notes**. Over 200,000 characters (or payload length over 200,000) it **removes the mirror entirely**. A dirty 250k note therefore also un-mirrors a small note edited alongside it.
- **IDB commit timing:**
  - `scheduleSave` (Notes.tsx L71–L82) is a 300 ms trailing debounce that restarts on every key. While typing continuously there's no commit until the first pause of 300 ms or more; a held key or a fast typist can go seconds.
  - Each save writes every note record (a structured clone of the 2M string at the 2M cap).
  - For a mirrorless note, crash loss = everything since the last idle commit.
- **pagehide/hidden flush:**
  - `flushNotes` → `flushNotesMirror` (a no-op above 200k) → `flushOpenConnection` (L496–L525).
  - At `675a9f5` the `put`s went out synchronously inside the pagehide handler. At head they're issued inside `indexRequest.onsuccess`, a later task.
  - On F5, navigation or a tab close, the document can unload before that task runs, so no `put` is ever sent. The transaction also never calls `tx.commit()`.
  - The hidden path (tab switch, then later renderer kill, RUL-34d path 4) probably survives because the page keeps running while hidden. The F5 and close paths (1–2) are the exposed ones.
  - For notes of 200k or less the mirror masks this (the QA pass at 1 ms on 675a9f5 used the mirror).
- **Hand-back ("Use here"):**
  - When the old writer yields (L231–L236), `dropWriterMemory` clears `dirtyNotes` and the cache and cancels the pending mirror frame, **without flushing**.
  - At 200k or less, the last rAF mirror write is still in shared localStorage, and the new writer's `withFresherMirror` merges it (S4-02 fixed for that case, runtime still required).
  - **Above 200k the yielding tab's uncommitted edits are dropped silently.** That's an S4-02 residual for large notes.
- **Fit with D-029/D-035:**
  - D-035 S4-17's "mirror holds only dirty notes, cleared after commit, one write per keystroke, synchronous on pagehide/hidden, failed write removes the old mirror" is **met at or below 200k** (confirmed: `rememberNotes` L358–L370, `markCommitted` L422–L430, `bindMirrorFlush` L348–L356, the catch removes the old mirror).
  - It is **not met above 200k**. Settings and windows writes are safe at every size (separate keys, and the cap keeps the mirror small), so the reason for the cap is real. The fix should keep that property.
- **Suggested fix:**
  - Mirror only the dirty region (an id plus a patch: start, deleteCount, inserted text), or mirror per note up to the quota with a per-note key.
  - Issue the `put`s synchronously in the pagehide handler with the ids the writer already knows, then call `tx.commit()`.
  - On yield, run the synchronous flush before releasing.

### Q4. Performance on an RTX 3060, 1080p, HIGH

**Estimate: average fps risk LOW. 1% low risk MEDIUM, from hitches rather than steady cost. GPU memory risk LOW at DPR 1 but HIGH at DPR 2 (HIGH allows dpr [1, 2]).** Per feature:

| Item | Finding (confirmed from code unless marked) |
|---|---|
| **Shadow map** | One directional light, a 2048² map on HIGH (4096 on ULTRA) and a single orthographic ±22 m camera (near 8, far 70; `shadowFit.ts`). No cascades. r186 turns the requested PCFSoft into **PCF**. The texel is 44 m / 2048 ≈ 2.1 cm, stretched about 4.8× along the sun on horizontal receivers at 12° elevation (≈ 10 cm), so edges are soft or blocky (S5-17). The map is about 16.8 MB. |
| **Shadow pass draws** | Casters: 20 opaque architecture boxes, 30 furniture boxes, the instanced rocks, fig pot, headland and lighthouse, so about 54 draws before culling (the headland at x 52 is outside ±22 m, so ~51). Receivers: all solids and the glass. Curtains, leaves, ocean and sky don't cast. `renderer.info` totals include the shadow pass (KNOWN_ISSUES L90), so the builder's 92–103 HIGH draws is plausible and under the 150 budget. |
| **Ocean** | A 380 × 270 m plane, 72 × 42 segments on HIGH: **3,139 vertices / 6,048 triangles** (LOW 36 × 22). Vertex: a 5-iteration Gerstner loop, trivial. Fragment: normalize, reflect, the analytic sky with 2 cloud noise layers, a glitter hash, a 4-rock foam loop and haze, roughly 150–250 ALU per pixel. Drawn late among the opaques, so early-z culls covered pixels. Cost is low. **Visual:** grid spacing 5.3 × 6.4 m against wavelengths 4.2 / 7.5 / 12 m (HIGH) and 10.6 × 12.3 m against 12 m (LOW), so the short waves are sub-Nyquist and will shimmer or swim (S5-16). |
| **Sky dome** | A 400 m sphere, `renderOrder −10`, `depthWrite false`. It's shaded for every pixel it covers, before anything else, so it gets no early-z benefit. The shader is cheap (3 value-noise layers). |
| **MSAA 4x + post** | HIGH: MSAA 4 on HalfFloat composer targets, Bloom (mip blur), AgX. SMAA is off on HIGH. At 1080p, DPR 1: the MSAA input is about 99.5 MB, and bandwidth is about 6 GB/s at 60 fps, trivial for a 3060's 360 GB/s. Post costs about 1–1.5 ms. |
| **Fill rate at DPR > 1** | HIGH's dpr is [1, 2]. At DPR 1.5 the pixel count is 2.25×; at DPR 2 it's 4×. The MSAA input alone is 224 MB at 1.5 and **398 MB at 2, over the 384 MB budget on its own** (S5-10). |
| **Curtains** | Billow is in the vertex shader (`onBeforeCompile`, one `uTime` uniform). **No per-frame CPU vertex work, no buffer uploads, no `computeVertexNormals`.** Normals aren't displaced, so lighting on the billow is flat (POLISH). The billow is toward −Z (into the room), capped at 0.35 m, and never crosses the glass. |
| **PMREM** | Generated once in a `useEffect` with deps `[gl, scene, onReady, clouds]` (Scene.tsx L305–L323). It's one-off per `clouds` value, and **it regenerates on every AUTO tier change that changes `cloudLayers`** (LOW 1 / MED 2 / HIGH 3), which is a hitch. It is **not** regenerated after context restore (S5-09, suspected). `pmrem.dispose()` runs only at unmount, so the 768 × 1024 HalfFloat ping-pong target (6.3 MB) stays allocated (confirmed from library: `PMREMGenerator._allocateTargets`). |
| **Hitches (1% lows)** | Shader compile on first HIGH frame and on AUTO tier changes (new sky material, PMREM rebuild, post rebuild). First upload of the five 1024² canvas maps plus mipmaps. Per-frame allocations: the string key in `syncQuads` and pose arrays. None of these affect the steady state, but D-015's 1% low of at least 50 is sensitive to them. |
| **Is the 147.5 MB estimate complete?** | **No** (`gpuMemory.ts`; `textures.ts` L196–L200). It misses: the **MSAA resolve texture** (≈ 16.6 MB at 1080p, which `renderTargetBytes` doesn't add); the **default framebuffer and swap chain** (≈ 16–25 MB); **mipmaps** on the canvas maps (×1.33); the **real PMREM** (6.3 MB target plus 6.3 MB ping-pong, against a 4 MB allowance); and the **retained 512 and 1024 canvas sets** (`retainTextureSize` is never called; 25 MB of 2D-canvas backing, possibly GPU-resident in Chrome). The 7-map count over-counts, because clones share one GL texture (three's texture cache key ignores `repeat`). Net, realistic HIGH at 1080p DPR 1 is about **200–250 MB** (fits 384). DPR 1.5 is about 330–370 MB; DPR 2 is over 384. The shadow map is counted (`shadowMapBytes`). |

**What the runtime run must measure (RTX 3060, 1080p, headed Chrome, DPR 1):**

- **Fps:** average and 1% low over the 5-minute golden-path loop on HIGH, with the perf HUD off and on.
- **Draws and triangles:** `getPerf()` calls and triangles at V2, the hero stance, the terrace and the corridor.
- **Frame time split:** from a Chrome trace; shadow pass vs main vs post if a GPU timer query is available.
- **GPU memory:** Chrome Task Manager GPU memory and `about:gpu` against `getGpuMemory().bytes`, at DPR 1, 1.25, 1.5 and 2 (browser zoom or OS scale).
- **Hitch tests:** worst frame on world entry, on each AUTO tier change (force with `setFakeFps`), and on context restore. Count shader compiles (`programs`).
- **Ocean swim:** a video at the hero stance on LOW and HIGH (S5-16).
- **Shadow quality:** screenshots of shadow edges on the living floor and the terrace.
- **Curtains:** confirm the curtain billow never shows through the glass.

### Q5. Ray sets after the art pass (D-032 / D-027)

**Verdict: correct, confirmed from code.** Every set is derived only from `world.collision.colliders` = `level.ts` boxes with non-empty layers plus `furnitureColliders` (`level.ts` L103–L107; `raySets.ts`; `WindowRig` occluder cache L45–L54; `crosshair.ts`). Scene-only meshes (sky, ocean, rocks, cliff plane, headland, lighthouse, curtains, leaves, visual furniture boxes, rug, cup, book) are in **no** set.

| Member | Movement | Placement ray | Occlusion | Crosshair |
|---|---|---|---|---|
| Walls (corridor ×3, living W/E/back-W/back-E/header), fin, piers | yes | yes (pin surface) | yes | yes |
| Floors, ceilings | no | yes (float stops) | no | no |
| Glass ×4, rails ×3 | yes | yes (float pulled 0.3 m back) | **no** | **no** |
| Soffit, jambs, rail cap, curtains | **no** | **no** | **no** | **no** |
| Tables (coffee, island, dining, desk) | yes | yes (table pose on top, upright pin on sides) | no | no |
| Sofa, lamp, bookshelf, stools, shelf, reading chair, bench, terrace chairs, **fig planter** | yes | yes (blocks, so a float lands 0.3 m before it) | **no** | no |
| Fig leaves, sky, ocean, rocks, headland, lighthouse, rug, cup, book | no | no | no | no |
| Window quads | — | — | — | yes (≤ 25 m, now `FrontSide`) |

- Counts are placement 38, occlusion 11 and crosshair 11. These match the builder's production smoke.
- Curtains are also not pin surfaces.
- A placement ray over the sea hits nothing, floats and is clamped to z ≤ 8.85.
- **Minor gaps:**
  - The bookshelf isn't a pin surface, though WIN-06 lists shelf faces (S5-13).
  - Furniture never blocks the crosshair, so a window can be clicked through the island or sofa. That's consistent with D-032.

---

## S4 and addendum status (at `f5cc906`)

Counts: **FIXED 17, PARTIAL 8, NOT FIXED 0, REGRESSED 0** (S4-08 is PARTIAL with a new regression, S5-05). DEFERRED per D-035: the WIN-09 far card and the tray Recall/Show part of S4-16. N1 and N2 are FIXED in code, pending runtime.

| ID | Sev (orig) | Status | Evidence at head |
|---|---|---|---|
| S4-01 rails at seams/corners | BLOCKER | **PARTIAL** | Old seams pass numerically (Q1). New release dead stop, S5-01. Snaps, S5-02. S3-01 stays open |
| S4-02 hand-back overwrite | BLOCKER | **PARTIAL** | The yield drops the writer cache and dirty set (`storage.ts` L212–L236, L333). At 200k or less the rAF mirror carries the yielding tab's edits to the new writer (`withFresherMirror` L770–L781). **Above 200k those edits are lost** (S5-04). S3-04 stays open until RUL-34b(j) passes |
| S4-03 limit cuts the tail | MAJOR | FIXED | `trimInsertion` with a selection (L45–L81) and `applyTextEdit` trim only the inserted text; surrogate-safe |
| S4-04 backface mirrored/interactive | MAJOR | **PARTIAL** | Opaque `#B7A894` back plate with glyph and title, `backface-visibility: hidden`, `rotateY(180deg)`, `pointer-events: none` (`frameBack.ts`; `WindowFrame` L245–L259). Per-frame dot(view, normal) < 0 sets `pointer-events` and `data-facing-back` (`WindowRig` L297–L306; normal maths verified). The crosshair quad is `FrontSide`, so E and clicks from behind miss, including E from the terrace (three `Mesh.raycast` back-face culling). **Keyboard is not blocked** (S5-06) |
| S4-05 SCR-08 rect lost on close | MINOR | FIXED | Rects merged per app and restored (`persistence.ts` L140–L161; `model.ts` L176); persisted on drag or resize end |
| S4-06 Web tile tabHidden | MINOR | FIXED | `externalOpenKeepsScreen` holds SCREEN until visible again (`shellMachine.ts` L60–L69); Settings links call `noteExternalOpen`. Stuck-hold residual suspected (S5-15) |
| S4-07 D-031/D-034 limiter | MINOR | FIXED | Own `emergencyFor` timer, outside the budget, sets the ceiling (`autoQuality.ts` L74–L96); boundary test L80–L91. Re-selecting AUTO residual, S5-14 |
| S4-08 placement extent | MINOR | **PARTIAL** | Floor and ceiling 2 cm and rail done, but the clamp uses the house box and treats half-width as world X (S5-05) |
| S4-09 float over the sea | MINOR | FIXED | z ≤ railZ − 0.15 = 8.85, eye check after clamp, auto-pin clamped (`placement.ts` L324–L336, L343–L376). "Zone bounds" are the whole house box (see S5-05) |
| S4-10 quarantine gaps | MINOR | FIXED | Index rebuilt from record keys with a notice; readers don't write (`storage.ts` L710–L761; `Notes.tsx` L125–L126) |
| S4-11 save failure shown as read failure | MINOR | FIXED | "This note could not be saved."; `readonly` is silent; not locked (`Notes.tsx` L71–L82) |
| S4-12 windows-file guarding | MINOR | **PARTIAL** | Per-world merge and malformed-pin quarantine are in. A failed corrupt-blob backup returns empty **without holding writes**, so the next persist overwrites the blob. Quarantine copies repeat per read (S5-12) |
| S4-13 remount loses note | MINOR | FIXED | `uiMemory.ts`, per window, in session |
| S4-14 no-locks fallback | MINOR | FIXED | BroadcastChannel election (30 ms, lowest id), notice when neither exists (`storage.ts` L244–L288). No re-election on leader close (S5-21) |
| S4-15 WIN-10 caret | MINOR | **PARTIAL** | The caret-from-point mechanism was added, but it uses `clientX/Y` of a pointer-locked click, which the spec freezes at the lock-entry point (S5-07) |
| S4-16 pin tag / far card | POLISH | **PARTIAL** (+DEFERRED parts) | A 42 px DOM tag, billboarded, restores on click and on shelf re-open (`WindowLayer` L16–L40; `model.ts` L55–L63). Not occluded and not clickable from WORLD (S5-11). Far card and tray: DEFERRED per D-035 |
| S4-17 mirror quota / key time | (suspected) | **PARTIAL** | Dirty-only mirror at or below 200k (Q3). Not above 200k (S5-04). Key time is solved by the window, which breaks editing (S5-03) |
| S4-18 CanvasBoundary swallow | (suspected) | FIXED | The `lost`-flag swallow was removed; only context-loss messages are swallowed |
| S4-19 focus scroll | (suspected) | FIXED | Stage scroll pinned to 0; `focus({preventScroll})` everywhere |
| S4-20 spring at 20 fps | MINOR | FIXED | Substeps at 1/60. Stability numeric: h·ω = 0.27, damping ratio 0.99 |
| S4-21 5 mm offset | POLISH | FIXED | `SURFACE_OFFSET 0.01`; the clamp side effect is under S5-05 |
| S4-22 surrogate | MINOR | FIXED | `withoutSplitPair`, `deleteText` pair-aware |
| S4-23 recall arm never expires | POLISH | FIXED | 10 s arm, cleared on `setWindowMode` (`model.ts` L27–L37, L149) |
| S4-24 straddle | (suspected) | FIXED | Any corner behind the near plane hides the window (`projector.ts` L14–L30, L129–L134). Pop-out POLISH, S5-20 |
| S4-25 hot-path work | MINOR | FIXED | Occluder cache, quad key, 2-sample occlusion, 400 ms persist throttle and flush on pagehide |
| **N1** detach without lock | — | FIXED (code) | `carryIntoWorld` goes to RELEASED plus a lock request; a rejection stays RELEASED and carrying (`shellMachine.ts` L138–L143; `InputManager` L138–L142). Suspected residual: Esc to SCREEN from RELEASED doesn't auto-pin (auto-pin only fires from WORLD) |
| **N2** program leak | — | FIXED (code) | Composer released and `info.programs` destroyed on lost and before restore (`ContextGuard` L41–L64; `contextRelease.ts`); post stack unmounted while lost. Runtime: REG-RT-02 counter |

---

## Other checks

- **D-033 back plate:** opaque, never mirrored DOM, frame colour `#B7A894` with glyph and title, no pointer input from behind, E and clicks front-hemisphere only (FrontSide raycast), E from the terrace blocked. **Keyboard from behind is not blocked (S5-06).**
- **D-034 limiter:** correct except for re-selecting AUTO while already AUTO (S5-14). A manual change clears both ceilings (`settings.ts` L51; `QualityDirector` L90–L95).
- **D-035:**
  - S4-09 met.
  - S4-08 not met (S5-05).
  - Wall pins at 1 cm are met, except on the side walls (S5-05).
  - S4-16 pin tag in with gaps (S5-11).
  - S4-12 partial (S5-12).
  - S4-17 met only at or below 200k (S5-04).
  - S4-14 met.
- **Test hooks:** gated by `devHooksEnabled()` (`NODE_ENV !== 'production' \|\| NEXT_PUBLIC_GHILAND_TEST_HOOKS === '1'`, `installDevHook.ts` L20–L22). No `window.__ghiland` in a normal production build. The carry trace is off in production (L81–L85).
  - `armQuotaError` and `injectMalformedPin` code ships in the production bundle but is unreachable.
  - **`armQuotaError` doesn't work in a real browser (S5-08).**
  - A production build made with the flag (the builder's smoke) exposes everything. Deploy pipelines must not set it.
- **Bundle size:** **not derivable** without a build (connector-only review). The new world code is procedural (about 1.1k lines, no assets), so the world chunk grows by a few KB gzip. The landing change is 1 line. The last measurement was landing ≈ 197 KB gzip at `9bebec2`, over the 150 KB budget, and that stays open for the runtime run.
- **WIN-14 teardown (confirmed from code):**
  - House materials and cloned maps are disposed through the `owned` list.
  - Sky, ocean and curtain materials, headland and beacon, and PMREM (target, generator, probe geometry and material) are disposed on unmount.
  - JSX geometries and instanced meshes are auto-disposed by R3F.
  - The base canvas maps go through `module.dispose` → `dropSeasideTextures`.
  - The pin tag is DOM only (no texture).
  - The GPU byte tracker is untracked on unmount.
  - Gaps:
    - Both the 512 and 1024 canvas sets stay cached for the session (`retainTextureSize` is never called).
    - The PMREM ping-pong target is held until unmount.
    - After context restore, canvas textures re-upload from their canvases, but **the PMREM render target comes back empty** (S5-09).
- **Art licensing:** no third-party assets. Everything is procedural (`ASSET_CREDITS.md`), and the Settings credits say so. Audio is unchanged. No issue.
- **D-027 sun:** the sky, curtain and ocean `uSun` (−0.367, 0.208, 0.907) equals (cos12°·sin(−22°), sin12°, cos12°·cos22°), matching `sunDirection(12, −22)` used for the light (confirmed numerically). The back panel colour is `#B7A894`.
- **Regressions to earlier fixes:**
  - S5-03 (Notes editing, previously native).
  - The pagehide flush order (S5-04; it was synchronous at `675a9f5`).
  - S5-05 (side-wall pins, previously on the wall).
  - None found in the S2/S3 shell, audio or context-loss paths.
  - `CanvasBoundary` is now narrower (intended).

---

## New findings

Owner key: **Forge** = engine (collision, placement, rendering, input), **Pixel** = shell, UI and apps (Notes), **Aura** = world art and level, **Atlas** = rulings, specs and test plan.

### S5-01 — BLOCKER — Release-held dead stop at the dining-table / west-wall junction (S4-01 residual)
- **Status:** confirmed (numeric re-implementation of head `collision.ts`).
- **Where:** `src/engine/player/collision.ts` L113–L131 (`releaseOpeningEdge` side choice and corner test), L190–L200 (`slideMove` retry); `src/worlds/seaside-house/furniture.ts` L31 (`dining-table` minX −6.45 → expanded −6.75, overlapping the wall's expanded −6.7).
- **Mechanism:**
  - Moving along the west wall into the table's north (or south) face, Z is shortened. The table's minX corner looks like an "opening", because the wall isn't a coplanar continuation, so `faceContinuesPast` is false.
  - The release sets x = −6.751, which is inside the wall's expanded box. The retry "gains Z", so it is accepted, but the final `pushOut` pushes the player back. The player freezes every frame, even though a plain slide would glide east along the table face.
- **Repro (MOV-18 style):**
  - From (−6.68, 4.0) walk at a heading of 160° (S+D-ish, facing +Z). The player stops at about (−6.699, 3.501).
  - From (−6.7, 0.9) at 15°, the player stops at about (−6.699, 1.599).
  - Affected headings are 147°–168° and 12°–27°. There are 76 grid cases; no other release-caused dead stops exist.
- **Fix:** reject a release whose `edgeX ± SKIN` lies inside any other expanded box, or whose final `pushOut` undoes it. Add a regression test for wall–furniture junctions using `seasideColliders`, not `[piece]`.
- **Owner:** Forge. **Rating note:** it's off the golden path. Rated BLOCKER as the same bug class as S4-01 under D-033; Master can downgrade it.

### S5-02 — MAJOR — Corner release teleports the player up to 0.28 m in one frame against the input
- **Status:** confirmed (numeric).
- **Where:** `collision.ts` L117–L122, L131. The side is chosen by distance to the nearer corner, not by the direction of `dx`.
- **Effect:** within 0.3 m of any expanded corner, while pressing into the face with any lateral component, x is snapped to the nearer corner even when the input moves away from it. The grid found 1,470 single-frame backward jumps over 2 cm, max 0.281 m (≈ 17 m/s), on 17 boxes.
- **Repro (heading 0° = +Z):**
  - Coffee table: from (4.95, 0.86) at 245°, pressing SW into the north face, the player jumps **east** 0.25 m to (5.201, 0.85).
  - Glass opening: from (1.95, 4.16) at 5°, x jumps 0.25 m to 1.699, into the opening.
  - Reading chair: from (−2.5, 2.76) at 355°, x jumps +0.281.
  - Corridor mouth: from (1.05, −3.19) at 115°, the player is pulled into the corridor.
  - It also happens on the golden path: V2 at 40° (pier-east, 0.09 m); terrace → living at 150° (coffee table, 0.15 m) and 225° (stool/island, 0.2 m).
- **Fix:** only release toward the corner that the movement's lateral component points at (or when |dx| ≈ 0). Cap the release displacement to a per-frame lateral speed, or round the corner (capsule vs rounded box).
- **Owner:** Forge.

### S5-03 — BLOCKER — Notes over 8,000 characters: the windowed editor breaks basic editing (regression)
- **Status:** confirmed (code plus the Input Events spec). The runtime visual effect of the re-flow is suspected.
- **Where:** `src/apps/notes/Notes.tsx` L153–L158 (`paintBody`), L188–L243 (`beforeinput`), L423–L444 (keys), L466–L471; `src/apps/notes/bodyWindow.ts` L4–L13.
- **Sub-items:**
  - (a) Enter or new line does nothing (`insertLineBreak` has null `data`).
  - (b) Undo and redo are disabled, and the native stack is cleared.
  - (c) IME is double-inserted and cut (`insertCompositionText` isn't cancelable).
  - (d) Word and line deletes go the wrong way or are one character.
  - (e) Select-all, copy, cut and find see only the slice.
  - (f) Up/Down/PageUp/PageDown/wheel/drag can't leave the slice, so the middle of a 1 MB note is unreachable.
  - (g) The slice re-centres every key, so everything re-flows and jitters.
  - (h) The screen reader sees only the slice (suspected).
- **Repro:** paste 10,000 characters, put the caret in the middle, then:
  - press Enter (no newline);
  - press Ctrl+Z (nothing);
  - type "你好" with Pinyin (doubled text);
  - press Ctrl+A, Ctrl+C and paste elsewhere (8,000 characters);
  - press Ctrl+Delete (deletes the character before the caret).
- **Owner:** Pixel (implementation); Atlas (ruling on key→glyph at 2M versus native editing). See Q2 for the fix options.

### S5-04 — BLOCKER (under RUL-34d/f; Master can re-rate via question 11) — Large notes: no mirror, weaker pagehide flush, hand-back loss
- **Status:** confirmed (code). Unload timing is suspected until measured.
- **Where:**
  - `src/apps/notes/storage.ts` L338 (`MIRROR_MAX_CHARS`), L397–L420 (total-size cap removes the whole mirror), L496–L525 (`put`s deferred to `indexRequest.onsuccess`, no `tx.commit()`), L212–L236 (yield drops the dirty set without a flush).
  - `Notes.tsx` L71–L82 (the debounce restarts per key).
- **Repro:**
  - A 250,000-character note: type a marker and F5 within 1 ms and within 50 ms, 10× each. Also close the tab, and do "Use here" from a second tab while typing.
  - A 1k note edited together with a dirty 250k note: F5.
  - Expected fail: the marker is lost. Per the plan, loss beyond 300 ms of content = BLOCKER.
- **Fix:** see Q3. Mirror per note or per patch up to the quota, issue synchronous `put`s plus `tx.commit()` on pagehide, and flush before yielding.
- **Owner:** Pixel; Atlas for question 11.

### S5-05 — MAJOR — Placement clamp: side-wall pins pushed 0.44 m off the wall; yaw and interior walls ignored (D-035 S4-08 not met; WIN-06 regression)
- **Status:** confirmed (code plus arithmetic).
- **Where:** `src/engine/windows/placement.ts` L313–L337 (`containPlacement`: `minX/maxX` = house box ± **halfW on world X**, Z only ± 2 cm); `WindowRig.tsx` L103–L113 and `actions.ts` L13–L27 (bounds = `walkable` −7…7 × −9…9 for the whole house; the ceiling is chosen by the **eye's** z, not the window's).
- **Repro:**
  - Aim at the living-room east wall (x = 7) and pin a 440 px window. The wall pin at x 6.99 is clamped to x ≤ 7 − 0.423 − 0.02 = **6.557**. The window floats 0.43 m off the wall, still `placement: 'surface'`. The same happens on the west wall.
  - A window pinned on the east wall near the back corner has its width along Z, so it can enter the back wall by up to half its width.
  - Interior walls (corridor, fin, piers) aren't considered at all.
  - A corridor-south pin sits 2 cm off, not 1 cm.
- **Fix:**
  - Clamp the four rotated corners, not the centre.
  - Push along the surface normal for surface pins (never along the wall).
  - Use per-zone bounds (corridor, living, terrace) chosen by the window position.
  - Add tests for a side-wall pin and a corner pin.
- **Owner:** Forge.

### S5-06 — MAJOR — Keyboard input into a window seen from behind is not blocked (S4-04 residual, D-033)
- **Status:** the missing gate is confirmed from code; reachability via Tab is suspected.
- **Where:** `WindowRig.tsx` L297–L306 (only `pointer-events` and `data-facing-back` are set); `src/shell/windows/FocusGuard.tsx` (the Tab cycle over `[data-ghiland-screen]` doesn't filter `data-facing-back`).
- **Repro:** pin Notes, walk behind it, press Esc (SCREEN) and Tab until focus enters the note, then type. The text changes while only the back plate is visible.
- **Fix:** toggle `inert` (or `tabIndex = -1` plus a blur) with `data-facing-back`, and skip facing-back windows in FocusGuard.
- **Owner:** Pixel.

### S5-07 — MINOR — S4-15 caret uses the frozen pointer-lock `clientX/Y`, not the crosshair
- **Status:** confirmed (Pointer Lock spec: clientX/Y "held constant" while locked).
- **Where:** `CrosshairRig.tsx` L18–L20; `actions.ts` L183–L196.
- **Repro:** enter WORLD by clicking the canvas near its top-left, aim at the middle line of a pinned note and click. The caret lands at the entry-click spot, or nowhere if that spot is outside the field, not under the crosshair.
- **Fix:** use the viewport centre (the crosshair) as the point.
- **Owner:** Forge.

### S5-08 — MINOR — `armQuotaError()` cannot work in a real browser
- **Status:** confirmed (WebIDL `[[Set]]` on a Storage object calls its named-property setter).
- **Where:** `src/state/persist.ts` L30–L44 (`storage.setItem = …`).
- **Effect:** in Chrome, assigning `localStorage.setItem` stores an item named `"setItem"` (with the function text) and leaves the method intact. Nothing throws. RUL-34e(f), RUL-34f(e), S4-11 and BRK-14 runs using the hook would **falsely pass** and pollute storage.
- **Repro:** call `__ghiland.armQuotaError()` in a flag build, then `localStorage.getItem('setItem')`.
- **Fix:** patch `Storage.prototype.setItem` once and restore it, or use `Object.defineProperty` on the instance.
- **Owner:** Forge.

### S5-09 — MINOR — PMREM lighting isn't rebuilt after context restore
- **Status:** suspected. The mechanism is confirmed from code and library: a render-target texture has no CPU source to re-upload.
- **Where:** `src/worlds/seaside-house/Scene.tsx` L305–L323 (deps don't change on restore); `art/environment.ts` L5–L21 (also holds the 6.3 MB ping-pong target until unmount, so call `pmrem.dispose()` right after `fromScene`).
- **Repro:** HIGH, screenshot at V2, `loseContext()` then restore, screenshot again. Expect a darker interior and no glass reflection.
- **Owner:** Aura / Forge.

### S5-10 — MAJOR — GPU memory: HIGH at DPR 2 exceeds 384 MB, and the estimate misses about 50–75 MB
- **Status:** confirmed (arithmetic plus code); runtime numbers needed.
- **Where:** `src/engine/quality/profiles.ts` HIGH `dpr: [1, 2]`, `multisampling: 4`; `gpuMemory.ts` L8–L12 (`renderTargetBytes` omits the MSAA resolve texture); `textures.ts` L180–L200 (estimate; `retainTextureSize` unused).
- **Detail:** the MSAA input is 99.5 MB at 1080p DPR 1, 224 MB at DPR 1.5 and **398 MB at DPR 2**. Untracked: resolve (16.6 MB at DPR 1), default framebuffer, mipmaps, the real PMREM plus ping-pong, and the retained canvas sets.
- **Fix:** cap HIGH's DPR at 1.5, or drop MSAA above DPR 1.25. Count the resolve target and the canvas sets. Call `retainTextureSize(size)` after a tier settles.
- **Owner:** Forge.

### S5-11 — MINOR — Pin tag is never occluded and can't be clicked from WORLD
- **Status:** confirmed (code).
- **Where:** `WindowRig.tsx` L253–L268 (the tag branch `continue`s before the occlusion test, with `pointer-events: auto`); L62 (`syncQuads` skips minimized windows, so there's no crosshair target); `WindowLayer.tsx` L16–L40.
- **Repro:** minimize a pinned note and walk into the corridor. The tag stays visible through the wall. In WORLD, aim at it and click: nothing happens (it only works with the mouse in SCREEN).
- **Fix:** apply the occlusion fade to tags, and add a small crosshair quad (about 8 cm) for tags.
- **Owner:** Pixel / Forge.

### S5-12 — MINOR — Windows file: a failed corrupt-blob backup is overwritten later; malformed pins are re-quarantined on every read
- **Status:** confirmed (code).
- **Where:** `src/shell/windows/persistence.ts` L244–L247 (returns empty without setting `writesHeld`, so the next `persistWindows` replaces the blob); L222–L241 (quarantine on each read; `persistWindows` reads the file on every write, `actions.ts` L56–L59).
- **Fix:** set `writesHeld = true` when the backup fails, and quarantine once (mark it handled or rewrite the file immediately).
- **Owner:** Forge.

### S5-13 — MINOR — Table pose and pin surfaces
- **Status:** confirmed (code).
- **Where:** `placement.ts` L249–L275; `furniture.ts` L25–L33.
- **Detail:**
  - The bottom edge sits at 0 cm on the top.
  - Nothing keeps the width over the table (up to 0.42 m overhang on the coffee table ends and past corners).
  - The 10° tilt puts the top 0.19 m behind the hit point.
  - Table side faces give an upright pin standing on the floor.
  - The bookshelf isn't a pin surface (WIN-06).
- **Fix:** clamp the pose so the bottom edge's projection stays inside the top's footprint minus a 2 cm margin (or mark it invalid), lift it 2 cm, and decide whether side faces pin. Atlas should rule on the bookshelf.
- **Owner:** Forge / Aura.

### S5-14 — MINOR — Re-selecting AUTO while already on AUTO doesn't clear the session ceiling (D-034)
- **Status:** confirmed (code); reachability depends on the Settings control.
- **Where:** `QualityDirector.tsx` L91 (`if (state.quality === prev.quality) return;`), while `settings.ts` L51 still clears the persisted ceiling.
- **Fix:** trigger the reset from an explicit "AUTO selected" action.
- **Owner:** Forge.

### S5-15 — MINOR — The external-open hold can stick and swallow the next real tab-hide
- **Status:** suspected.
- **Where:** `InputManager.ts` L309–L311 (blur passes `hidden = true`, so `externalHold` is set); L321–L323 (cleared only by a visible `visibilitychange`).
- **Repro:** Shift-click a Settings credit link (it opens a window, so the page never hides) and return. Later, hold W and switch tabs. The shell doesn't go to tabHidden and keys aren't cleared (a stuck walk).
- **Fix:** set the hold only from `visibilitychange`, and expire it after the 500 ms window if the page never hid.
- **Owner:** Forge.

### S5-16 — POLISH — The ocean grid under-samples the short waves
- **Status:** confirmed (numeric).
- **Where:** `art/scale.ts` L11–L16; `art/waves.ts` L11–L17; `Scene.tsx` L185–L196.
- **Detail:**
  - HIGH spacing is 5.3 × 6.4 m against λ 4.2 / 7.5 / 12 m.
  - LOW is 10.6 × 12.3 m against λ 12 m.
  - Displacement and per-vertex normals alias and swim.
- **Fix:** move the short waves to fragment normals only, or use a distance-graded grid.
- **Owner:** Aura.

### S5-17 — POLISH — Art details
- **Status:** confirmed (code).
- **Detail:**
  - Leaves ignore HIGH's `alphaToCoverage` (`Scene.tsx` L111–L118).
  - Curtain normals don't follow the billow (flat light).
  - The shadow ortho ±22 m at 2048 gives about 10 cm effective texels on floors at 12° sun. Fit it to the house (±10 m) or add a near cascade.
  - The requested PCFSoft is PCF in r186.
- **Owner:** Aura.

### S5-18 — POLISH — Test coverage gaps behind S5-01 and S5-02
- **Status:** confirmed (code).
- **Where:** `collision.test.ts` L195–L197 (checks listed rail x values only), L258–L286 (furniture tested in isolation).
- **Detail:** no junction test, no "no backward snap" assertion. The MOV-18 golden walk now depends on heading (46°–60.5° reach the hero stance).
- **Owner:** Forge (tests); Atlas (MOV-18 wording).

### S5-19 — POLISH — Composition-ending Esc flag clears in a microtask
- **Status:** confirmed (code).
- **Where:** `InputManager.ts` L296–L302.
- **Detail:** engines that fire `compositionend` before the Esc `keydown` (Safari, non-gating) still let that Esc through.
- **Owner:** Forge.

### S5-20 — POLISH — Near-plane cull hides the whole window when one corner crosses it
- **Status:** confirmed (code).
- **Where:** `projector.ts` L132–L134.
- **Detail:** the window pops out when you walk alongside a pinned window. This is acceptable for 0.1; clipping would be better later.
- **Owner:** Forge.

### S5-21 — MINOR — BroadcastChannel fallback never re-elects when the leader tab closes
- **Status:** confirmed (code).
- **Where:** `storage.ts` L244–L288. `released` is only posted on yield; there's no pagehide announcement.
- **Detail:** readers stay read-only until "Use here". That's acceptable since the button exists, but it should be recorded (RUL-34b(k)).
- **Owner:** Pixel.

---

## Runtime-check list for the QA runner

Environment: real RTX 3060-class desktop, 1080p, headed Chrome on a real desktop session (visibility tests need it), build with `NEXT_PUBLIC_GHILAND_TEST_HOOKS=1` for hooks, plus one normal production build for the no-hook check. Log `visibilitychange` events. Record the SHA (`f5cc906` or the fix head).

1. **MOV-18 / S5-01 / S5-02:**
   - The seam starts (x 3.699, 4.301, 1.551) and 89.9°/90.1° strafes.
   - S5-01: (−6.68, 4.0) at 160° and (−6.7, 0.9) at 15°.
   - S5-02: coffee table (4.95, 0.86) at 245°; glass (1.95, 4.16) at 5°; corridor mouth (1.05, −3.19) at 115°. Record the per-frame x delta through `setPlayer` plus the camera path.
   - Walk every furniture seam and the three narrow slots.
   - V2 → hero stance at 40°, 43°, 46°, 50° and 60°.
2. **RUL-34g (S5-03):**
   - At 8,001 / 50k / 1M / 2M characters: Enter, Ctrl+Z/Y, Pinyin and Japanese IME in the middle and at the boundary.
   - Ctrl+Backspace and Ctrl+Delete, Ctrl+A then Ctrl+C (compare length and hash), Ctrl+F for markers at 10%, 50% and 99%.
   - PageDown and the wheel to the end; a SHA-256 after reload.
   - NVDA reading lines past the boundary.
3. **RUL-34f(g) and RUL-34d (S5-04):**
   - 200,001 / 250k / 1M / 2M notes: marker then F5 at 1 ms and 50 ms (10×); tab close; hide then Task-Manager kill.
   - "Use here" hand-back while typing into a 250k note.
   - A small note edited alongside a dirty 250k note.
   - Log `localStorage` mirror writes and IDB commit times.
4. **RUL-38 (S4-04 / S5-06):**
   - Back plate from 0°–180° (screenshots).
   - Click, E and **Tab + type** from behind; E on `hero-sea` from the terrace.
   - `data-facing-back` toggling.
5. **RUL-39a–d (S5-05 / S5-13 / S5-11):**
   - Pin on the east and west walls (measure distance to the wall), a corner pin, a corridor-wall pin.
   - Table pose on each table (overhang, 0 cm), float at the balustrade (z ≤ 8.85).
   - Minimized tag through a wall, and clicking it from WORLD and from SCREEN.
6. **PERF-01 / D-015:**
   - Average and 1% low on HIGH over the 5-minute loop.
   - `getPerf()` draws and triangles at four stations.
   - Worst frame on entry, on tier changes (`setFakeFps`) and on restore.
   - GPU memory from Task Manager and `about:gpu` against `getGpuMemory()` at DPR 1, 1.25, 1.5 and 2 (S5-10).
   - Ocean swim video on LOW and HIGH (S5-16); shadow screenshots (S5-17).
7. **RUL-28a/b and REG-RT-02 (N2 / S5-09):** 10 lose/restore cycles, the `createProgram − deleteProgram` counter, `programs`, heap, and before/after screenshots at V2.
8. **REG-RT-01 (N1):** reject `requestPointerLock` during a detach held 6 s, expect RELEASED plus carrying, then the next click locks. Then Esc to SCREEN while carrying and record where the window goes.
9. **RUL-36 (D-034):** 40 fps then 29 fps × 2.5 s gives no demotion; 29 fps × 3.1 s gives one, sets the ceiling and doesn't count toward the budget. Then a manual change, and re-select AUTO while AUTO (S5-14).
10. **Hooks (9.3):**
    - The normal production build has no `window.__ghiland`.
    - `armQuotaError()`, then check `localStorage.getItem('setItem')` (S5-08); don't trust quota results until fixed.
    - `injectMalformedPin()`: count quarantine keys after 3 persists (S5-12).
11. **S4-15 (S5-07):** enter WORLD by clicking the canvas corner, then click a pinned note line and record the caret index.
12. **S4-06 / S5-15:** a credit link opened as a tab and as a window (Shift-click), then a later real tab switch while holding W.
13. **Bundle:** `next build` output for the world chunk and landing (gzip) against 600 / 150 KB.

---

## SUMMARY

- **The PR can't merge.**
  - Step 8's art is procedural, licence-clean, well disposed and correctly kept out of every ray set.
  - The addendum's N1/N2 fixes look right in code.
  - 17 of 25 S4 items are fixed in code.
- **The blockers:**
  - A new collision dead stop of the S4-01 class (S5-01).
  - The new 8,000-character Notes window, which breaks Enter, undo, IME and navigation (S5-03).
  - Large notes losing recent typing on F5, close, crash or hand-back (S5-04).
  - S4-04's missing keyboard guard (S5-06), which gates under D-033.
- **Also serious:** side-wall pins pushed 0.44 m off the wall (S5-05), up to 28 cm snaps at every furniture corner (S5-02), and HIGH at DPR 2 over the 384 MB budget (S5-10).
- **Performance:** steady-state HIGH at 1080p DPR 1 on a 3060 is probably fine. Hitches and DPR need measuring.

## WHAT WAS DONE

- Pinned and re-checked the head `f5cc906` and read all 82 changed files through the connector (patches plus full files for `placement.ts`, `level.ts`, `WindowFrame.tsx`, `FocusGuard.tsx`, `gpuMemory.ts` and `profiles.ts`).
- Re-implemented head `collision.ts` with all level and furniture boxes. Swept 3,482 starts × 120 headings × 2 s, ran a 5 cm × 72-heading single-step snap scan, and traced the golden-path headings.
- Checked three.js behaviour (FrontSide raycast culling, PMREM target sizes, render-target restore, texture cache key) and web-platform behaviour (Input Events data and cancelability, Pointer Lock clientX/Y, WebIDL Storage named setter).
- Worked through the Notes window, mirror and flush timing and the GPU memory arithmetic.
- Wrote this file.

## FILES / SYSTEMS AFFECTED

- New file: `docs/qa/REVIEW_PR5_STEP_8.md` (this file, box only). No other file changed. Nothing posted to GitHub.
- Systems reviewed:
  - collision
  - placement and table pose
  - window back plate, focus and pin tag
  - Notes editor, mirror and IDB flush
  - AUTO limiter
  - context loss and restore
  - art pass: sky, ocean, PMREM, shadows, textures, curtains
  - test hooks
  - windows-file persistence

## IMPORTANT DECISIONS

- S5-01 is rated BLOCKER under D-033 (same mechanism as S4-01) even though it's off the golden path. Master may downgrade it.
- S5-03 is rated BLOCKER because it's a regression of core editing that PR #5 introduced, for notes over 8,000 characters.
- S5-04 is rated BLOCKER per the plan's own RUL-34d/f rule. It depends on Master's question-11 ruling, but the flush-order regression stands either way.
- S4-04's keyboard gap (S5-06) is treated as gating because D-033 names keyboard input explicitly.
- S4-08 is marked PARTIAL, not REGRESSED, because the floor, ceiling and rail parts work. The side-wall regression is filed separately as S5-05.

## RISKS

- Runtime may show that Chrome does finish the deferred IDB `put`s during unload. S5-04's F5 path would then be milder, but the crash and hand-back paths remain.
- The S5-02 snaps may feel worse than the numbers suggest (camera pops), which matters for comfort.
- Fixes to S5-03 may re-open the key→glyph requirement at 2M. Atlas should rule before Pixel rebuilds.
- Hitches from tier changes (shader compile plus PMREM rebuild) could fail the 1% low gate even though the average is comfortable.
- A production build made with the hooks flag exposes storage-fault hooks. Deploy configuration must not set it.

## KNOWN LIMITATIONS

- No build, run or browser: fps, memory, bundle size, visual quality, screen-reader behaviour and unload timing are estimates or suspected until the runtime pass.
- The collision port is exact for head `collision.ts`, but it only models the horizontal slide (not the look or the variable dt clamp).
- The PR-body artefacts behind the cursor.com login weren't seen.
- The builder's claimed runtime evidence (MOV-18 numbers, RUL-34b/c, GP-11, 189 tests) wasn't re-run. It's consistent with the code except where the findings say otherwise.

## RECOMMENDED NEXT ACTION

1. Master and Atlas:
   - rule on question 11 (the mirror size exception);
   - rule on the Notes key→glyph target versus native editing (choose Q2 option (a));
   - confirm the S5-01/S5-04 ratings.
2. Forge:
   - fix S5-01 and S5-02 together in `releaseOpeningEdge`, with junction and no-snap tests;
   - fix S5-05 (a rotated-corner clamp, per-zone bounds);
   - fix S5-08, S5-10 (DPR cap) and S5-12.
3. Pixel:
   - revert or rework the window (S5-03);
   - fix the pagehide flush and add large-note persistence (S5-04);
   - make facing-back windows `inert` (S5-06).
4. Re-review the fix head, then run the runtime-check list above on the RTX 3060 machine before sign-off.
