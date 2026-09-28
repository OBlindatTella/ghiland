# Ghiland Alpha 0.1: QA & Performance Test Plan
Author: Sentinel (QA, Performance & Product Critic) · Status: DRAFT v0.2, proposal for Ghiland Master / Francesco · 2026-09-28 (v0.2 folds in Plan items 13–22, D-010…D-015)
Scope: Alpha 0.1, one world (Seaside House). This is Phase C of the roadmap, prepared before Phase B so Forge knows what the build will be judged on.
Every number in this document is a **PROPOSAL awaiting confirmation**. Sentinel reports problems and doesn't redesign. Where specs still disagree after Master's synthesis, this plan records the conflict and doesn't pick a winner.

---

## 0. Inputs

| Source | Status when read (2026-09-28, 22:26–22:33) | Used for |
|---|---|---|
| docs/GHILAND_STATE.md | Phase A complete and synthesised; waiting for the repo choice before Phase B | Milestone, success test, stack, deferred list (mobile, multiplayer, WebXR, integrations are out of scope) |
| docs/ALPHA_0.1_PLAN.md | Master synthesis, items 1–22. **Wins over the Phase A docs on conflict** | Conflict resolutions 1–12, rulings 13–22 (anchors, pinned scale, occlusion layers, entry, foliage AA, audio streaming, key hints, QA gates, hero composition, sound assets), build order, greybox checkpoint |
| docs/DECISIONS.md | D-001 … D-015 | D-001 preview cards · D-002 app strategies · D-003 DOM windows · D-004 `Q` · D-005 carry/pin/pick up · D-006 SCREEN pauses movement · D-007 no jump/sprint · D-008 unlit content · D-009 scope · D-010 anchors/glass/pinned scale · D-011 single-page entry · D-012 foliage AA + streamed beds · D-013 QA gates · D-014 hero anchor + Notes 440×560 · **D-015 hardware override** |
| docs/phase-a/ATLAS_ARCHITECTURE.md | Approved, amended through Plan 13–20 (read 22:35 rev) | Single-page `<GhilandApp/>`, collider layers, placement rule, 520 px/m, window modes, input owners, EnvironmentState, tiers + composer MSAA, perf probe, budgets, streamed beds |
| docs/phase-a/AURA_WORLDS.md | Approved (read 22:38 rev) | Layout (open panels x 0…+4, D-019), `hero-sea` anchor, spawn/reveal, light, audio (beds stream), camera numbers, UI-in-world rules, budgets, "never" list |
| docs/phase-a/PIXEL_UI_SYSTEM.md | Approved, Rev 2 (read 22:40) | WORLD/SCREEN/RELEASED, keys, Screen, windows, placement incl. anchors, 520 px/m, Notes 440×560, hero-sea size cap, QWERTY-label fallback, a11y baseline |
| aura/atmosphere-foundations-v0.md | Earlier Aura proposal, superseded | Only where Pixel still cites it (flagged) |

(phase-a/ was empty when v0.1 was started; the specs, the synthesis and the rulings landed during drafting. v0.2 is based on the files as read between 22:39 and 22:41.)

Precedence used here: ALPHA_0.1_PLAN.md / DECISIONS.md > Atlas / Aura / Pixel. Expectations cite `[D-00x]`, `[Plan #n]`, `[Atlas §x]`, `[Aura §x]`, `[Pixel §x]`. Items still open are marked `OPEN: X-nn`. Behavior no document covers is marked `PENDING SPEC: <owner>`. Sentinel's own expectations ("no crash", "no silent data loss") are quality floors, not design choices.

### 0.1 Cross-spec conflicts and gaps: status

Resolved items keep a residual note where Sentinel still sees a testable risk. Each ruling (Plan 13–21, D-010…D-015) has a dedicated verification test in section 4.7 (RUL-xx).

| ID | Issue | Status | Tests |
|---|---|---|---|
| X-01 | Screen key | **RESOLVED** `Q` [D-004] | GP-7, SCR |
| X-02 | Meaning of "detached" | **RESOLVED** carried, camera-anchored (0, 0, −1.1), 150 ms lag; `P` pins; `E` picks up ≤ 25 m; `Q` returns [D-005]. Residual: Atlas says `E` put-down "maps here too", so test both | GP-9/10, WIN-05 |
| X-03 | Pinned-window occlusion | **RESOLVED** raycast fade against `occluder`-layer colliders only; glass, curtains and plants never occlude [Plan #6, #15, D-010]. Residual: Aura §6 still says furniture occludes, but Atlas layers give furniture no `occluder` (Plan wins: furniture doesn't occlude) | RUL-15, GP-11, WIN-21 |
| X-04 | Hero pin spot reachability | **RESOLVED** anchor snap within 1.5 m, glass never a snap surface, `hero-sea` authored [Plan #13, #21, D-010, D-014] | RUL-13, RUL-21, GP-10 |
| X-05 | Speeds, sprint, jump | **RESOLVED** [D-007] | MOV-03/16 |
| X-06 | FOV setting | **Partly resolved**: Plan #14 accepts text size at "the 75° FOV max", which implies a 55–75° setting (Atlas stores FOV), but Pixel §7 still defers the FOV slider to 0.2. Needs a one-line confirmation | MOV-12, SCR-12, RUL-14 |
| X-07 | Idle breathing | Resolved: 2 s [Aura §5] | MOV-13 |
| X-08 | Tab hidden audio | Resolved: 6 dB fade over 400 ms [Atlas §7]. Residual: Pixel's "Mute when tab is hidden" toggle wording | AUD-10 |
| X-09 | Entry flow | **RESOLVED** Pixel's single page; card click unlocks audio; sea starts at once under the sharpening backdrop; no Enter page, no black screen; URL follows via `pushState` [Plan #16, D-011, Atlas §1] | RUL-16, GP-1..4 |
| X-10 | Budgets | **RESOLVED** Atlas's budget table stands until Sentinel measures [Plan #20]; gating hardware set by the user [D-015]. Section 2 applies both | Section 2 |
| X-11 | Foliage AA | **RESOLVED** composer MSAA 4× + alpha-to-coverage on HIGH/ULTRA (SMAA dropped there); alpha-test + SMAA and sparser foliage on LOW/MED; ULTRA DPR cap 2.0 [Plan #17, D-012] | RUL-17 |
| X-12 | Decoded audio memory | **RESOLVED** long beds stream through media elements; only one-shots and wave variations are decoded; 64 MB cap stays [Plan #18, D-012] | RUL-18 |
| X-13 | px → metres | **RESOLVED, superseded** 520 px/m [Plan #14, D-010] | RUL-14 |
| X-14 | Pinned text legibility | **RESOLVED** 520 px/m targets ≥ 14 px body text at 1080p from 1.75 m (predicted 14.8 px); Sentinel measures in the step-7 build [Plan #14] | RUL-14, A11Y-05 |
| X-15 | Carried window when lock is lost (blur / tab hidden → RELEASED) | **OPEN** (minor): not addressed by rulings 13–22. Floor in DES-03 | DES-03/04/16 |
| X-16 | Pinned persistence | **RESOLVED** [D-009]. Residual: localStorage ~5 MB quota | WIN-17, DES-08 |
| X-17 | Unspecified: context-loss recovery, mobile behavior, UI sound design, explicit mute, captions | **OPEN** (gaps, not conflicts): not addressed by rulings 13–22 | BRK-01/12, AUD-09/15, A11Y-06 |
| X-18 | **New, from Pixel Rev 2:** at `hero-sea` a window larger than 0.85×1.08 m is scaled down to fit. A resized Notes (e.g. 560×640) would land at ~659 px/m, so body text at 1.75 m ≈ **11.7 px**, below the 14 px ruling | **OPEN** | RUL-14c, RUL-21 |
| X-19 | **New:** behavior when a second window is pinned to an occupied anchor (up to 4 single-instance apps could all snap to `hero-sea`) isn't specified | **OPEN** | RUL-13g |
| X-20 | **New (minor):** placement details differ. Horizontal surfaces: Pixel "stands tilted 12°" vs Atlas "snap flat using the hit normal". Aiming through glass: Pixel treats a glass hit as "nothing, float"; Atlas ignores glass in the raycast, so the ray can hit a pin surface *behind* the glass (e.g. a terrace table within 3 m) and pin the window outside | **OPEN** | RUL-13e/f, WIN-06 |


## 1. Severity rules and issue reporting

### 1.1 Severity definitions

| Severity | Definition (any one condition is enough) | Examples |
|---|---|---|
| **BLOCKER** | Golden path (section 3) can't be completed on Chromium (Chrome or Edge) on the GATING tier. Crash, white or black screen, "Aw, Snap", or a state that can only be recovered by reloading (including getting stuck in geometry). Notes content lost without warning. Security or privacy issue. Below the gating performance hard floor (avg FPS < 40 at HIGH, or recurring freezes > 500 ms while walking). A leak that crashes the tab or passes the 400 MB heap ceiling within 60 min | Pinned window vanishes while walking; loading crossfade never happens; no audio after the card click |
| **MAJOR** | Golden path completes but a step is visibly broken or degraded. A core feature is broken but has a workaround. A performance budget missed by > 20%. A motion-sickness trigger. Clearly wrong audio (L/R swapped, audible loop, clicks or pops, spatialisation missing). Golden path broken in the Firefox or Safari smoke run (logged, tagged `NON-GATING`). An immersion break that shows up in every session (section 8 "never" list). A first-time user can't work out a golden-path step within 60 s with only the specified hints. The detach/snap gesture misfires ≥ 1 in 20 attempts | Esc leaves a state where neither look nor UI works; 45 ms hitch on every Screen summon; pinned window swims against the wall on fast turns |
| **MINOR** | Off-golden-path behavior is wrong but there's an easy workaround. Budget missed by ≤ 20%. A noticeable cosmetic defect that doesn't break immersion. Edge-case failures (section 5) without data loss | Wrong resize cursor; tray thumbnail stale; 1 dropped frame on close |
| **POLISH** | Works as specified but feels off: timing, easing, mix, micro-copy, alignment. Logged as an observation, never as a redesign | Summon fade feels a beat slow; footsteps slightly loud on teak |

Modifiers:
- **First-60-seconds rule:** anything a first-time user hits in the first 60 s goes up one level (to MAJOR at most, unless it already meets BLOCKER).
- **Non-gating scope:** issues found only on Firefox, Safari or the informational hardware tiers (Iris Xe, M1) get a normal severity plus the tag `NON-GATING`. They're reported and routed but don't block Alpha 0.1 [D-013, D-015]. A crash or data loss there is still escalated to Master the same day.
- **Frequency** is recorded separately (Always / Often >50% / Sometimes / Rare / Once). A Rare BLOCKER is still a BLOCKER.
- **Fake-polish rule:** an effect that looks good in a screenshot but fails in use (text unreadable at the bright terrace spot, a progress line that doesn't track real progress) is logged against the failure, not downgraded to POLISH.
- Missing or ambiguous spec: the issue is still logged, tagged `SPEC-GAP`, and routed to the spec owner.

### 1.2 Responsible specialist (default routing)

| Area | Owner | Secondary |
|---|---|---|
| Implementation bugs, controller, collisions, gameplay code | Forge | spec owner |
| Architecture, stores, persistence, loading, quality/AUTO, perf probe, window projector, context loss | Atlas | Forge |
| World, light, materials, atmosphere, audio design and mix, scene and asset budgets | Aura | Forge |
| Screen, windows, input states and keys, hints, UI legibility, UI accessibility | Pixel | Forge |

### 1.3 Issue report template

```
ID:            GHL-A01-###
Title:         <component>: <what is wrong> (<where/when>)
Severity:      BLOCKER | MAJOR | MINOR | POLISH      Frequency: Always|Often|Sometimes|Rare|Once
Area:          MOV | CAM | SCR | WIN | NOTES | AUD | LOAD | PERF | BRK | A11Y | ART | CRIT
Tags:          SPEC-GAP · REGRESSION · FIRST-60S · NON-GATING · X-nn / RUL-nn
Build:         commit <sha> · prod/dev · URL · quality tier (forced or AUTO→resolved)
Environment:   OS+ver · browser+ver · GPU (chrome://gpu) · RAM · resolution + DPR + refresh rate · mouse/trackpad · keyboard layout · audio output
Preconditions: fresh profile? cold cache? localStorage state?
Repro steps:   1. ... 2. ... 3.
Expected:      <spec + section> or "quality floor: ..."
Actual:
Evidence:      video (required for MOV/WIN/AUD/PERF), screenshot, console log, perf trace .json, heap snapshot, PerfHud/renderer.info dump, audio recording
Responsible:   Atlas | Aura | Pixel | Forge
Notes:         workaround, first seen, related IDs
```

---

## 2. Performance budgets

### 2.1 Hardware tiers

**Hardware override (user decision, D-015):** Francesco set the target as a desktop or laptop with a **dedicated GPU**, and that's the gating tier. Master's D-013 defaults (Iris Xe at 30 fps on LOW, M1 at 60 fps on HIGH) become **informational, non-gating** tiers. Master is being told about the override; at the time of writing it's already logged as D-015, superseding the hardware part of D-013. The Plan #20 principle ("Atlas's budget table stands until Sentinel measures") is kept: the gating ceilings below are Atlas's HIGH column, with Aura's stricter HIGH numbers as non-gating targets.

| Tier | Reference machine (proposal) | Display | Quality | Status |
|---|---|---|---|---|
| **GATING** | Dedicated GPU, **RTX 3060 / 3070 class** (desktop, or laptop with the Laptop-GPU equivalent). **Measure on the RTX 3060** as the weakest in the class. 6–8-core CPU (Ryzen 5 5600X / i5-12400 or better), 16 GB+, Windows 11, Chrome stable + Edge stable | 1920×1080 @ 60 Hz, DPR 1.0 | **HIGH (forced)** | Gates sign-off |
| Informational A | 2022 laptop, Intel Iris Xe (i5-1235U / i7-1255U class), 16 GB | 1080p @ 60 Hz | LOW (D-013 default) | Record only; must "degrade gracefully" [D-015] |
| Informational B | MacBook Air M1/M2 | Retina, DPR 2 | HIGH (D-013 default) | Record only |
| Informational C | GATING machine on a 120/144 Hz monitor, uncapped | 1080p / 1440p | HIGH, ULTRA | Record only |

Protocol:
- **Production build only.** `next dev` numbers are rejected. Check that `leva` is absent from the prod bundle [Atlas §8].
- **Force the tier** for budget runs (HIGH on GATING). Test AUTO separately (LOAD-10), because AUTO changing DPR mid-run makes numbers incomparable.
- Fresh profile, no extensions, fullscreen at native resolution, vsync on (60 Hz). Laptops: plugged in, "Balanced" power mode, plus a **thermal run** after 20 min of continuous use (dGPU laptops throttle too).
- 30 s warm-up, then 3 × 60 s on a **fixed scripted camera path** (test hook, section 10); report the median.
- Cross-check the app's own `PerfProbe` against an independent instrument (injected rAF sampler, DevTools trace, stats.js). Don't rely on the app measuring itself.
- Viewpoints (Aura coordinates): **V1** spawn (0, 1.62, −8.2) · **V2** reveal point (0, 1.62, −3) · **V3** open panel (−2, 1.62, 4.0) facing the sea · **V4** balustrade looking down at rocks/foam/spray · **V5** terrace looking back at the interior · **V6** V3 + Screen + Notes overlay · **V7** V3 with 8 visible pinned windows · **V8** V2 at night (only if Slow sunset ships).

### 2.2 Gating budgets (Chromium, GATING tier, HIGH, 1080p @ 60 Hz). PROPOSALS

| Metric | Gate | Non-gating target / note | Source | How measured | Tools |
|---|---|---|---|---|---|
| **Average FPS** on the walking path | **≥ 60** (vsync-locked; operationally ≥ 59.0 over the run) | — | D-015 | rAF deltas over 60 s | Injected rAF sampler (Playwright), PerfHud, stats.js |
| **1% low FPS** (1000 / p99 frame time) | **≥ 50** (p99 ≤ 20 ms) | — | D-015 / user | same samples | same |
| **Frame-time spikes**, steady state | 0 frames > 33.3 ms; ≤ 2 frames > 25 ms per min | — | Sentinel | count per 60 s run | DevTools Performance (Frames), rAF sampler |
| **Interaction hitch** (first Screen, first Notes, detach, pin, anchor snap, first sea view, streamed assets arriving, far-card swap, tier change) | worst frame ≤ 50 ms cold (first time); ≤ 33 ms warm (5th) | — | Sentinel | trace each action | CDP `Tracing`, DevTools |
| **First live frames** | no frame > 33 ms in the first 5 s after the crossfade | — | Pixel §4 | from `world:entered` | rAF sampler |
| **Long tasks** after interactive | 0 > 50 ms while walking | — | Atlas §6 | PerformanceObserver('longtask') | DevTools, PerfProbe |
| **Draw calls** (worst V1–V7) | **≤ 150** | Aura ≤ 120 | Atlas HIGH (Plan #20) | `renderer.info.render.calls`, `autoReset = false`, manual per-frame reset (composer passes counted) | PerfHud, Spector.js |
| **Triangles** in view | **≤ 750k** | Aura ≤ 400k | Atlas HIGH | `renderer.info.render.triangles` | PerfHud, Spector.js |
| **GPU memory: textures + render targets** (estimated) | **≤ 256 MB**, including the composer's MSAA 4× targets | Aura textures ≤ 150 MB | Atlas HIGH; Plan #17 ("MSAA targets stay inside the texture budget") | estimator sums textures (w×h×bpp or KTX2 block size ×1.33) **plus render targets** (samples × w × h × bytes, colour + depth); cross-check with Chrome Task Manager "GPU memory". Sentinel estimate: MSAA 4× at 1080p/DPR 1 with half-float buffers is roughly 100–130 MB on its own, about 2.25× that at DPR 1.5 | Estimator (requested in PerfHud), Spector.js |
| **Decoded audio memory** | **≤ 64 MB**; streamed beds must not show up as `AudioBuffer`s | Atlas estimate ≈ 19 MB; > 32 MB is flagged for investigation | Plan #18, Atlas §7 | Σ AudioBuffer bytes (hook) + source-type list | Hook, DevTools Memory |
| **Simultaneous voices** | ≤ 16 | — | Aura §4 | active sources | Hook |
| **Pinned windows** | with 8 visible pinned windows (V7) the FPS and 1% low gates still hold | — | Atlas §4/§6 | V7 run | rAF sampler, long tasks |
| **JS heap after load** (post-GC) | **≤ 400 MB** | target ≤ 200 MB | Atlas HIGH | CDP `HeapProfiler.collectGarbage` → `JSHeapUsedSize` | Playwright + CDP |
| **Heap growth, 60-min soak** (post-GC, every 60 s, first 5 min excluded) | **≤ 10 MB net, slope ≤ 0.15 MB/min**; hard fail > 50 MB | — | Sentinel | linear regression; heap snapshot diff t=5 vs t=60 | Playwright soak, DevTools Memory |
| **GPU resource leak** | `renderer.info.memory` geometries/textures back to the start value after 50 summon/dismiss, 50 open/close, 20 pin/grab, 10 tier-change cycles | — | Sentinel | before/after | Hook |
| **DOM leak** | Nodes / detached nodes back to baseline ±5% after the same cycles | — | Sentinel | CDP `Nodes`, heap snapshot | CDP, DevTools |
| **Landing paint** (cold) | warm-dark shell ≤ 0.8 s; cards ≤ 2 s; LCP ≤ 2.5 s; TBT ≤ 200 ms | LCP ≤ 1.5 s | Pixel §4 | Lighthouse desktop + custom network | Lighthouse CI |
| **Time to interactive** (card click → "Click to walk" shown) | **≤ 8 s cold** at 50 Mbps / 20 ms RTT; **≤ 3 s warm** | ≤ 5 s cold at ≥ 100 Mbps (Atlas) | Pixel §4, Atlas §6 | `performance.mark` at click and `world:entered` | Playwright + User Timing |
| **Asset payload** | first playable ≤ 25 MB; full world ≤ 60 MB; card media ≤ 300 KB each | — | Atlas §6, Aura §2, Pixel §4 | HAR | Playwright, Network panel |
| **JS bundle (gzip)** | landing ≤ 150 KB, no three.js; engine ≤ 300 KB; Seaside ≤ 100 KB; each app ≤ 50 KB; **world route total ≤ 600 KB** | — | Atlas §6 | `next build` + analyzer; CI check | @next/bundle-analyzer, size-limit |
| **Audio start latency** | sea audible ≤ 500 ms after the Seaside card click (cold cache, streamed bed); `AudioContext` running ≤ 100 ms after the click | — | Plan #16, D-011 | timestamps at click / `resume()` / media `playing` event + output latency; loopback recording | Hook logs, recording |
| **UI sound latency** (if UI sounds ship) | ≤ 50 ms | — | X-17 | same | same |
| **UI responsiveness** | INP ≤ 200 ms; Notes key→glyph ≤ 50 ms at 10k chars and at 1 MB; overlay drag 1:1 in the same frame | — | Pixel §3.4 | web-vitals, Event Timing, 240 fps video | web-vitals, DevTools |

Failure → severity (GATING tier): miss by ≤ 20% = MINOR; > 20% = MAJOR; avg < 40 FPS = BLOCKER.

### 2.3 Informational tiers (recorded, non-gating)

| Tier | What's recorded | "Degrade gracefully" floor [D-015] (logged `NON-GATING` if missed) |
|---|---|---|
| Iris Xe, LOW | Full 2.2 table against Atlas's LOW column: ≤ 80 draw calls, ≤ 250k tris, ≤ 128 MB GPU memory, heap ≤ 300 MB, avg ≥ 30 fps (D-013 default) | Golden path completes; AUTO settles on LOW within 30 s and doesn't flap; avg ≥ 30 fps; no crash, no "Aw, Snap" in 60 min; the reveal, moving water, curtains and full sea soundscape are still present [Aura §2 "never cut"] |
| M1/M2, HIGH | FPS, 1% low, load, GPU memory at DPR 2 (Chrome and Safari) | Golden path completes in Chrome |
| 120/144 Hz uncapped, ULTRA | FPS, ULTRA DPR cap 2.0 respected, GPU memory incl. MSAA at DPR 2 | No tier flapping; frame pacing even |

## 3. Golden path walkthrough (the success test)

Run on Chrome on the GATING tier (RTX 3060, forced HIGH, 1080p @ 60 Hz), fresh profile, cold cache, headphones on, screen and system audio recorded. Pass = every step passes. Sign-off needs 10/10 consecutive passes in Chrome and 3/3 in Edge (section 10).

| # | Step | Pass criteria | Spec |
|---|---|---|---|
| GP-1 | Open the app URL | One landing page: warm dark screen (never pure black) ≤ 0.8 s; world cards ≤ 2 s; no "Enter" page; 0 console errors; 0 failed requests; no layout jump | D-011, Plan #16, Pixel §4 |
| GP-2 | Look at the world choices | Seaside House large, centre-left, silent loop from the spawn camera. NY Balcony and Farm desaturated with "Soon". Clicking a preview card shows one line and "Alpha 0.2" and never enters or breaks anything | D-001, Pixel §4, Aura §7 |
| GP-3 | Click the Seaside House card (or `Enter` on the focused card) | This click unlocks audio: sea audible ≤ 500 ms, from a streamed bed. The card expands into the blurred backdrop, which sharpens in step with real progress (no fake progress, LOAD-01). No black screen at any point, no page navigation (URL changes via `pushState` only). World live ≤ 8 s cold; "Still arriving…" only after 10 s | D-011, Plan #16/#18, Pixel §4, Atlas §1 |
| GP-4 | World becomes live | Crossfade into the live render from the same camera pose with no cut or jump; no frame > 33 ms in the first 5 s; "Click to walk" after ~600 ms; the click locks the pointer; `W A S D` "to move" hint appears | Pixel §4, §5.2 |
| GP-5 | Walk to the window | Spawn in the corridor facing the sea sliver. About 4 m (≈3 s) past the fin wall comes the reveal: ceiling lifts, horizon at eye level, exposure dips then settles in ~1.5 s. The centre path to the glass (8 m) has no obstacles or snags. Closed glass panels block; the open panels let you through to the terrace; the balustrade blocks. A first-time user reaches the glass unaided within 60 s | Aura §2, §5 |
| GP-6 | Hear the sea | Audible but filtered from spawn; louder and brighter with every step. Low-pass opens from ~900 Hz deep in the room to ~3 kHz at the open panel with no stepping. Waves-on-rocks come from below the terrace, L/R correct when turning. No clicks, pops or audible loop in 5 min | Aura §4, Atlas §7 |
| GP-7 | Summon the Ghiland Screen | `Q` [D-004] or `Esc` from WORLD opens SCREEN: pointer unlocks, world dims 12%, shelf rises (240 ms). `E` on the desk device within 2 m does the same. Nothing depends on hover when the Screen appears. "`Q` your Screen" hint shows after 20 s of walking or near the desk. Hitch ≤ 50 ms | D-004, Pixel §1.2, §2.1–2.2, §5.2 |
| GP-8 | Open Notes | Notes tile → window grows out of the tile to **440×560**, centred, with keyboard focus in the page. Typing works; `W A S D`, `Q` and `P` type letters and never move the player, close the Screen or pin anything (SCREEN pauses movement) | D-006, D-014, Pixel §1.1, §2.4 |
| GP-9 | Detach Notes | Drag the title bar off the top or side edge and hold 300 ms. The lift indicator (0.96 scale, stronger shadow) looks clearly different from the snap outline. You're then carrying it: Screen closes, pointer locks, window camera-anchored ~1.1 m ahead with ~150 ms lag, and you can keep walking. Content, caret and scroll kept exactly; the same DOM node, no remount | D-005, Atlas §2.4/§4, Pixel §3.3–3.4 |
| GP-10 | Pin it near the sea view | Carry it toward the glass. Within 1.5 m of `hero-sea` the 1 px preview outline jumps to the anchor; `P` pins it exactly there (check `E` too, X-02 residual): upright, angled 15° toward the room, ≈ 0.85×1.08 m. Body text ≥ 14 px on screen from 1.75 m (RUL-14). The open panels (x 0…+4), horizon and sun glitter stay unobstructed (RUL-21). Never flat on the glass. Alternative path: pin button or `P` from the overlay while looking at the anchor area | D-010, D-014, Plan #13/#14/#21, Pixel §3.3 |
| GP-11 | Keep walking | Walk to the terrace and balustrade, back inside, into the corridor behind the fin, then return. Pass: position unchanged (≤ 1 cm via hook); no swim against the world on fast turns; **stays fully visible from the terrace through the glass** and fades out (~200 ms, never a hard cut) only behind walls and the fin (RUL-15); far card beyond 6 m, live content inside 6 m, no flash; content unchanged; clicking its content from WORLD enters SCREEN focused on it with no camera move, and typing continues; FPS gates hold | D-010, Plan #6/#15, Pixel §3.3, Aura §6 |
| GP-12 | Reload the page | Notes content is back; the pinned window is restored in the same place, same size, same content [D-009]; player back at spawn (position not persisted) | D-009, Atlas §3, §8 |
| GP-13 | Reaction | Rubric (section 8) scored at minute 1. Any "it's a website in 3D" reaction recorded verbatim | Section 8 |

First-time tester target (proposal): GP-1 → GP-11 in ≤ 3 min using only the specified hints, no step stuck > 60 s.

---

## 4. Functional test areas

"Expected" cites the spec; `PENDING` marks where synthesis or a spec is still needed.

### 4.1 Movement and camera (MOV)

| ID | Test | Pass criteria |
|---|---|---|
| MOV-01 | `W A S D` and arrow keys | Camera-relative movement, matched on `KeyboardEvent.code` [Pixel §1.4, Atlas §2.5]; clean stop on release |
| MOV-02 | Diagonals | No faster than straight movement (normalised) |
| MOV-03 | Speeds and easing (measured via hook) | 1.35 m/s, back ×0.8, strafe ×0.85, `Shift` 2.2 m/s [D-007, Atlas MovementSpec], each ±5%; full speed in ~0.45 s; stop glide ~0.2 s, "never icy" [Aura §5] |
| MOV-04 | Mouse look | 30–50 ms smoothing, pitch clamp ±80°, no roll [Aura §5]; same sensitivity at 60 and 144 Hz; `unadjustedMovement` on Chromium with silent fallback; single `movementX/Y` spikes clamped (Windows Chromium) [Pixel §1.3] |
| MOV-05 | Pointer lock entry | "Click to walk" locks the pointer; no view jump on lock |
| MOV-06 | `Esc` in WORLD | Goes to SCREEN, never a dead state [Pixel §1.3] |
| MOV-07 | Re-lock cooldown | `Esc`, then click the world immediately: rejection handled, "Click to walk" shown, the next click works, no retry loop, no uncaught `pointerlockerror` [Pixel §1.3] |
| MOV-08 | Collisions | Capsule 1.75 m × 0.3 m [Aura §5]; walls, furniture footprints, fin, island, stools, closed glass, balustrade; smooth wall-sliding, no jitter pushing into walls |
| MOV-09 | Getting stuck | Corners and gaps: kitchen stools, dining chairs, sofa/coffee table, reading chair, terrace bench, olive planter, lounge chairs, corridor ends. Never stuck (stuck = BLOCKER per 1.1) |
| MOV-10 | Falling out | Push diagonally into the 1.05 m balustrade at max speed, at 15 fps (CPU throttle), and during a 3 s main-thread stall: never tunnel through or fall to the sea |
| MOV-11 | Frame-rate independence / dt clamp | Same distance per second at 30/60/144 fps ±5%. Hold `W` through a 3 s stall: no teleport or tunnelling on resume |
| MOV-12 | Motion-sickness triggers | No head bob (≤ 6 mm step motion) [Aura §5]; FOV 62° vertical default (setting range: X-06); carry lag (150 ms) not nauseating on fast turns; no forced camera moves (clicking a pinned window must not move the camera [Pixel §1.2]); exposure adaptation not strobing. Tester nausea rating 1–5 after 10 min; any forced camera move = MAJOR |
| MOV-13 | Idle breathing | Starts after 2 s still, ~4 mm at 0.22 Hz [Aura §5]; stops instantly on input; pauses while the Screen is open [Pixel §2.2]; zero with reduce motion [Aura §5, Pixel §7] |
| MOV-14 | Drag-to-look fallback | Offered after 2 failed lock attempts; hold-left-button drag to look; `Shift`+arrows turn [Pixel §7] |
| MOV-15 | Sitting | Stretch goal [Aura §5]; test only if it ships |
| MOV-16 | `Space`, `Ctrl`, `Shift`+`W` in WORLD | No jump, no sprint: `Space`/`Ctrl` do nothing; `Shift` never exceeds 2.2 m/s [D-007] |

### 4.2 Ghiland Screen (SCR)

| ID | Test | Pass criteria |
|---|---|---|
| SCR-01 | Summon routes | `Q` / `Esc` from WORLD; `E` on the desk device at ≤ 2 m opens it, at 2.5 m does nothing [Pixel §2.1] |
| SCR-02 | Dismiss routes | `Q` (no text focus); clicking empty world with < 4 px travel, not within 200 ms of a drag ending, not on the 6 px resize halo [Pixel §1.2]; 160 ms |
| SCR-03 | `Esc` ladder in SCREEN | Close menu → cancel drag → blur text → RELEASED; never closes windows, never re-locks [Pixel §1.3] |
| SCR-04 | Overlay windows tuck and restore | Dismiss hides them [D-006]; summon restores exact position, size, scroll and content |
| SCR-05 | Empty Screen | Shelf only: no wallpaper, widgets or welcome text [Pixel §2.2] |
| SCR-06 | Launcher | Tiles in order Notes, Chat, Worlds, Settings; label after 400 ms hover or immediately on keyboard focus; open dot; `/`, arrows, `Enter`, `Esc` [Pixel §2.3] |
| SCR-07 | Single instance [D-009] | A tile for an open app focuses it; if it's in the tray it restores; if pinned: pulse, and a second click recalls it. Never duplicated [Pixel §2.4] |
| SCR-08 | Placement | Centred first; cascade +32 px; clamped to a 24 px safe area above the shelf; last rect remembered per app |
| SCR-09 | Summon cost | Hitch budget (2.2); scrim 12% (8% at night) [Pixel §6.7] |
| SCR-10 | Apps and D-002 | Chat mock gives canned/streamed replies, with no network calls to a real model [D-009]; the external-fallback test app shows a card and "Open" opens a new tab; any embed swaps to the external card on a blank-frame timeout [Atlas §2.3] |
| SCR-11 | Worlds app | Shows the same cards. Choosing Seaside while already in Seaside: `PENDING SPEC: PIXEL` |
| SCR-12 | Settings app | Changes apply live; sensitivity applies on the next WORLD entry; quality change debounced 400 ms behind a 200 ms fade; persists across reload; FOV control present or absent per X-06 [Pixel §5.1, Atlas §3] |

### 4.3 Window lifecycle (WIN)

| ID | Test | Pass criteria |
|---|---|---|
| WIN-01 | Drag | 4 px threshold; 1:1, no easing; title bar is the grip except its buttons [Pixel §3.4] |
| WIN-02 | Resize | 6 px halo, 14 px corners, min 320×200, max = safe area; text reflows and stays sharp |
| WIN-03 | Snap | Left/right half; top = "large" (safe area − 48 px); 8 px magnets, `Alt` disables them; double-click title toggles |
| WIN-04 | **Detach vs snap boundary** | 20 trials each of "snap to top" and "detach off top + 300 ms". Misfire ≥ 1/20 = MAJOR |
| WIN-05 | Carry | Camera-anchored (0, 0, −1.1), 150 ms lag, you keep walking [D-005, Atlas §2.4]; `Q` returns it to the overlay; `P` pins at the crosshair (and `E` if it maps there, X-02 residual); the preview outline matches the final spot; the carried window doesn't clip into walls when you walk up to one (1.1 m offset vs a wall 0.5 m away): record behavior |
| WIN-06 | Placement rule (general) | Order: anchor within 1.5 m → pin surface (walls, fin, bookshelf face: flat at 1 cm, upright; desk/tables/island: pose per X-20) → float 1.6 m ahead facing you. Glass, curtains and plants are never pin surfaces [Plan #13, Atlas collider layers]. Probe walls, fin, bookshelf, desk, dining table, island, floor (not a pin surface: floats), ceiling, 30–40° angles, inside corners. Anchor-specific cases are in RUL-13 |
| WIN-07 | Pin from overlay | Pin button or `P` (SCREEN, no text focus) pins where you're looking; typing "p" in Notes never pins |
| WIN-08 | Grab a pinned window | Look + `E` within 25 m with line of sight: flies to you in 360 ms. Behind a wall or at 26 m: nothing [Pixel §3.3] |
| WIN-09 | Far card | Swaps beyond 6 m. Walk back and forth across 6.0 m: no flicker (ask for hysteresis if it flickers) |
| WIN-10 | Use a pinned window in place | Click from WORLD → SCREEN focused, no camera move; the caret lands where clicked, also at 45° oblique |
| WIN-11 | Focus / z-order | Pointerdown raises and focuses; exactly one focused; unfocused chrome at 64%; content never dimmed [Pixel §3.5] |
| WIN-12 | Minimize | Overlay → tray thumbnail; pinned → ~8 cm pin tag at its anchor; `E` or a click restores |
| WIN-13 | Tray pinned entries | Recall / Show; Show pulses the window and adds an edge direction hint when it's off-screen |
| WIN-14 | Close | ×, no confirm, animates to the tile; reopening shows the content (autosave); renderer and DOM counts return to baseline |
| WIN-15 | Overlay hidden in WORLD | Overlay windows hide on returning to WORLD and restore on `Q` [D-006] |
| WIN-16 | Focus vs movement keys | No walking in SCREEN. Hold `W` in SCREEN, press `Q`: the player doesn't start walking on a stale key state; the reverse too. No stuck keys across any state change |
| WIN-17 | Persistence | Pinned windows per world, overlay rects and Notes all survive reload [D-009]; a window carried at reload comes back as overlay [Atlas §3]; corrupt storage handled (BRK-13) |
| WIN-18 | Pinned budget exceeded | 5 on LOW, 9 on HIGH: record behavior and FPS (Atlas budget ≤ 4 / ≤ 8 visible) |
| WIN-19 | Crispness | Walk from 3 m to 0.5 m: text sharp at every distance (Atlas: no `will-change`, scale down only); carried window text sharp while walking |
| WIN-20 | **Swim test** | Fast flick turns and strafing with a window pinned to a wall: 240 fps video, no visible slip between the DOM window and the WebGL wall (compositor desync risk of the DOM-over-canvas approach) |
| WIN-21 | Occlusion fade (general) | See RUL-15 for the ruling cases. Also: partial occlusion past a wall edge shows as a partly transparent whole window (accepted Alpha limit, Atlas §4) with no flicker from the 10 Hz sampling; fades smoothed, never stepped |

### 4.4 Audio (AUD)

| ID | Test | Pass criteria |
|---|---|---|
| AUD-01 | Autoplay / unlock | The Seaside card click unlocks audio [D-011]. Opening `/w/seaside-house` directly: card pre-selected, **no** audio before a click, audio starts on the first click, never a permanently silent session. No unhandled "AudioContext was not allowed to start" or media `play()` rejection |
| AUD-02 | Spatialisation | Rock sources L/R below the terrace [Aura §4]; HRTF on HIGH/ULTRA, equalpower on LOW/MED [Atlas §7], L/R correct on both; no zipper noise on fast turns |
| AUD-03 | Indoor filtering | Cutoff tracks distance to the open panels (≈ 900 Hz → 3 kHz); smooth, no audible stepping from the 10 Hz zone update [Atlas §7] |
| AUD-04 | Loops | 20-min listen at the open panel and in the corridor [Aura asks]: no audible loop. Wave events match the visual swell (6–9 s); spray sound in sync with the visual burst |
| AUD-05 | Rare events | 60-min event log (hook): gulls 25–90 s, big wave 2–5 min, horn 6–15 min, motorboat 10–20 min [Aura §4] |
| AUD-06 | Footsteps | 0.7 m stride; oak / teak / near-silent on the rug; settle step on stop; no steps while pushing into a wall without moving |
| AUD-07 | Room tone | Interior never fully silent [Aura §1] |
| AUD-08 | Volume | Master and Ambient sliders, v² mapping, no clicks (`setTargetAtTime`), persisted [Atlas §7, Pixel §5.1] |
| AUD-09 | Mute | No explicit mute control is specified (X-17); Master at 0 = silence with no pop |
| AUD-10 | Tab hidden / RELEASED | Tab hidden or blur: ambience fades 6 dB over 400 ms; RELEASED ducks 3 dB [Atlas §7]. Record what Pixel's "Mute when tab is hidden" toggle actually does (X-08 residual). On return: no burst of queued events, no doubled layers |
| AUD-11 | Levels | Limiter works; recorded peaks ≤ −1 dBFS; no startlingly loud first second |
| AUD-12 | Voices | ≤ 16 during a gust + big wave + gull + footsteps at once |
| AUD-13 | Output device change | Unplug headphones or switch Bluetooth: audio continues or recovers on the next gesture; no uncaught error |
| AUD-14 | No music by default | Aura §1 "never" list |
| AUD-15 | UI sounds | Atlas §7 and build step 8 plan event-driven UI sounds (`window:opened` tick), but none are designed: `PENDING SPEC: PIXEL` (X-17) |

### 4.5 Loading and transitions (LOAD)

| ID | Test | Pass criteria |
|---|---|---|
| LOAD-01 | Cold load / honest progress | Budgets 2.2. The progress visual correlates with network and decoding activity: it doesn't reach the end early and doesn't sit at the end for > 5 s |
| LOAD-02 | Warm load | ≤ 3 s; assets actually served from cache; returning users land with Seaside focused [Pixel §4] |
| LOAD-03 | Stall states | "Still arriving…" at 10 s; "Try Low quality" at 30 s, and the button works [Pixel §4] |
| LOAD-04 | Crossfade gate on weak GPUs | With CPU 6× throttle and forced ULTRA, where frames may never get under 20 ms: the crossfade must still happen (a timeout). Waiting forever = BLOCKER |
| LOAD-05 | Single page and URL | No document navigation from landing to world (one navigation entry); URL becomes `/w/seaside-house` via `pushState`; direct open of that URL gives the same page with the card pre-selected; browser Back/Forward after entering: no reload, no duplicated scene, canvas survives [Atlas §1, D-011] |
| LOAD-06 | Streaming | Micro props and ULTRA textures streamed after first paint [Aura §2]: no pop-in at the reveal, arrival hitch within budget |
| LOAD-07 | Shader warm-up | First sea view, first Screen, first pinned window, first far-card swap: hitch within budget |
| LOAD-08 | Leave and re-enter | Worlds app → Seaside again: heap and renderer counts return to baseline; ambience not doubled; no page navigation [Atlas §2.2 dispose, D-011] |
| LOAD-09 | No WebGL2 | One line plus a link [Pixel §4] |
| LOAD-10 | AUTO quality | Starts from the heuristic; tier drops after 5 s below 45 fps; ≤ 1 change per 30 s; none in the first 3 s; hidden behind a fade; no DPR "pumping" you can see [Atlas §6, Pixel §5.1] |

### 4.6 Broken states (BRK)

| ID | Test | Trigger | Pass criteria |
|---|---|---|---|
| BRK-01 | WebGL context lost | `WEBGL_lose_context.loseContext()` / `restoreContext()`; `chrome://gpucrash` | Floor: no silent white/black screen, Notes not lost. Recovery behavior `PENDING SPEC: ATLAS` (X-17) |
| BRK-02 | WebGL disabled | `--disable-webgl`, Firefox `webgl.disabled` | Message, no crash loop |
| BRK-03 | Tab hidden / restored | 10 s and 10 min; minimise the window | RELEASED, "Click to walk", no auto re-lock [Pixel §1.3]; no teleport; audio per AUD-10 |
| BRK-04 | Window resize | Continuous drag-resize; half-screen snap | Correct aspect, no stretching; overlay windows clamped back into the safe area |
| BRK-05 | DPR change | Drag between 1× and 2× monitors; change OS scaling live | Canvas follows the tier's DPR range [Atlas §6]; DOM text sharp |
| BRK-06 | Fullscreen | F11 and the Fullscreen API; `Esc` while locked and fullscreen | Behavior recorded (`Esc` also exits fullscreen [Pixel §1.3]); never trapped |
| BRK-07 | Low memory / low CPU | 30 heavy tabs; 8 GB RAM VM; CPU 4–6× throttle | Degrades via AUTO rather than crashing; no "Aw, Snap" within 30 min |
| BRK-08 | Slow network | "Slow 4G", "3G" | Stall states from LOAD-03; never an endless spinner |
| BRK-09 | Asset 404/500 | `page.route` abort per class: GLB, KTX2, Basis transcoder, HDRI, audio bed, audio one-shot, font, Notes chunk, card media | No uncaught rejection kills the scene; missing audio never blocks the world; a missing transcoder produces a clear error |
| BRK-10 | No audio device | All outputs disabled before load | World loads, no exception |
| BRK-11 | Offline mid-session | DevTools offline after the world is live | World keeps running; Notes keeps saving locally |
| BRK-12 | Mobile/tablet | Open on a phone | Out of scope (deferred). Behavior `PENDING SPEC: PIXEL`; observe and report |
| BRK-13 | Storage corruption | Inject invalid JSON, a future `version`, out-of-range volumes, missing fields into `ghiland:settings` / `ghiland:windows` / `ghiland:app:notes` | Corrupt blob moved to `…:corrupt-<ts>`, defaults used, values clamped, no boot crash [Atlas §3] |
| BRK-14 | Storage unavailable | localStorage throws (blocked site data, Safari private mode quirks); quota full | No crash; the user is told that Notes won't be saved (floor) |

---

### 4.7 Ruling verification tests (RUL): one per Master ruling

Each Master ruling gets a test that proves the build does what was decided. Instrumentation comes from the test hooks in 10.1. Tolerances are Sentinel proposals.

| ID | Ruling | Test cases | Pass criteria |
|---|---|---|---|
| RUL-13 | **Pin anchors; glass never a snap surface** [Plan #13, D-010] | (a) Pin with the crosshair hit 1.4 m from `hero-sea`. (b) Hit 1.6 m away. (c) Aim at the closed glass panel (x +4…+6) from 1 m, 2 m and 3 m. (d) Aim through the open panels (x 0…+4) at the sea. (e) 50 random pin attempts along the whole glass wall and the glass balustrade. (f) Stand 1 m inside a closed panel and aim at a terrace table or bench within 3 m behind the glass (X-20). (g) Pin a second app to `hero-sea` while Notes occupies it (X-19). (h) Preview outline vs final transform in every case | (a) Snaps to the anchor transform exactly (position ±1 cm, yaw/pitch ±1°). (b) No snap. (c, d) Never flat on glass: floats 1.6 m ahead unless the anchor is within 1.5 m of the float point, in which case it snaps. (e) 0/50 windows flat on or intersecting glass. (f) Record whether it pins outside through the glass (X-20). (g) Behavior per the future ruling; floor: both windows reachable, no z-fighting. (h) Preview = final transform in 100% of cases |
| RUL-14 | **Pinned readability: ≥ 14 px at 1080p from 1.75 m** [Plan #14, D-010] | Measured in the **step-7 build**. Test build adds a 15 CSS px calibration bar inside Notes content. Hook places the camera 1.75 m in front of the pinned window's centre, head-on, FOV 62°, 1920×1080, DPR 1; screenshot; measure the bar's on-screen height. Repeat at 1.5 m and 2 m, and at FOV 75° if the setting exists (X-06). Read `pxPerMeter` and pinned world size from the window registry. (c) Resize Notes to 560×640 in the overlay, then pin it to `hero-sea` (X-18) | **≥ 14.0 px at 1.75 m** (predicted 14.8). Recorded only: ~17.3 px at 1.5 m, ~13.0 px at 2 m, ~11.6 px at FOV 75° (accepted by the ruling). `pxPerMeter` = 520; default Notes 440×560 pins at 0.85×1.08 m ±2 cm. Text stays sharp closer than 1.73 m, where the content upscales (WIN-19). (c) If text < 14 px after the hero-sea size cap, log against X-18 |
| RUL-15 | **Occlusion layers: glass blocks movement, never occludes; only opaque architecture occludes** [Plan #15, D-010] | Hook reads pinned-window opacity and camera position. (a) Notes at `hero-sea`, view from 5 terrace positions through closed glass. (b) Walk behind the fin and into the corridor. (c) View past curtains (billowing), olive tree, indoor plants. (d) View past the sofa, kitchen island, dining table. (e) Walk into closed glass panels and the glass balustrade | (a) Opacity 1.0 at every terrace position. (b) Fades to 0 over ~200 ms when fully blocked, back to 1 when visible, never a hard cut, no flicker. (c) Opacity 1.0 (curtains and plants never occlude). (d) Opacity 1.0 (furniture isn't `occluder`; Plan wins over Aura §6's wording). (e) Movement blocked: can't pass closed glass or fall past the balustrade |
| RUL-16 | **Single-page entry; card click unlocks audio** [Plan #16, D-011] | Cold load, click the Seaside card; record screen + audio at 60 fps; log navigations, `AudioContext.state`, media events. Repeat via `Enter` on the focused card, and via a direct open of `/w/seaside-house` | One document navigation total; no Enter page; `AudioContext` running ≤ 100 ms and sea audible ≤ 500 ms after the click; sea plays under the sharpening backdrop, then the crossfade to the live render with no cut; **no recorded frame is pure black (#000) or near-black full-screen**; landing bundle has no three.js; engine chunk prefetched on idle/hover (network log); first pointer lock comes from the "Click to walk" click |
| RUL-17 | **Foliage AA: composer MSAA 4× on HIGH/ULTRA, alpha-test + SMAA on LOW/MED** [Plan #17, D-012] | Per tier: Spector.js capture + hook (composer `multisampling`, passes, foliage material flags); screenshots and a slow 10 s pan across the terrace grasses and olive tree at V3/V4; switch tiers LOW→MED→HIGH→ULTRA→LOW live; check DPR on a DPR 3 or zoomed display | HIGH/ULTRA: multisampled render target with 4 samples, `alphaToCoverage` on foliage, no SMAA pass. LOW/MED: `multisampling` 0, `alphaTest` foliage, SMAA pass present, sparser grass (30% / 60%). No visible crawl or shimmer on foliage, bronze frames or the balustrade cap on HIGH (video review); MED edges logged as POLISH if harsh. Tier switch: same WebGL context and canvas element (no `webglcontextlost`, no remount), foliage recompile hitch ≤ 100 ms hidden behind the 200 ms fade. ULTRA DPR ≤ 2.0. GPU memory incl. MSAA targets within 2.2 |
| RUL-18 | **Audio beds streamed; only one-shots and wave variations decoded; 64 MB cap** [Plan #18, D-012] | Hook lists each playing source and its type; decoded-bytes counter. (a) 20-min listen at the open panel and in the corridor. (b) Hook-seek each bed to 5 s before the end of its file, 5 times. (c) Reload 5×. (d) Slow 4G throttle. (e) Tab hidden 10 min, then return. (f) Firefox and Safari smoke | Sea, wind and room-tone beds are `MediaElementAudioSourceNode`s, never `AudioBuffer`s; decoded bytes ≤ 64 MB (expected ≈ 19 MB). (a) No audible loop (AUD-04). (b) The two-element crossfade (~3 s before the end, equal power) leaves no gap, click or level dip; the recording shows no dropout > 10 ms. (c) The start offset differs across reloads. (d) A stalled stream doesn't glitch the other buses; record any audible dropout. (e) Beds resume in sync, no doubling. (f) Beds play (non-gating). No CORS errors (same origin) |
| RUL-19 | **Key hints from keymap + `getLayoutMap()`; QWERTY fallback where missing** [Plan #19] | Chromium with US, Italian, AZERTY, QWERTZ layouts; Firefox and Safari with AZERTY. Trigger every hint (`W A S D`, `Q`, `E`, `P`, "Click to walk · Q Screen"). Test build: rebind an action and re-trigger its hint | Chromium: labels match the physical key under the active layout (AZERTY shows Z Q S D, and A for the Screen key; QWERTZ unchanged for W A S D). Italian: W A S D, Q. Rebinding changes the hint (it reads the keymap, not hard-coded text). Firefox/Safari: QWERTY labels shown, recorded as a **known limitation**, not a bug. Bindings work physically on all layouts in all browsers |
| RUL-20 | **QA gates: Chromium gates; Firefox/Safari smoke-only; dedicated-GPU gating hardware** [Plan #20, D-013, D-015] | Process check at sign-off | Sign-off evidence comes from Chrome and Edge on the GATING tier; Firefox/Safari smoke results attached, issues logged as `NON-GATING`; informational tiers recorded per 2.3 |
| RUL-21 | **Hero composition** [Plan #21, D-014, D-019] | Hook reads the `hero-sea` transform. Pin default Notes (440×560) there. Screenshots from the reveal point (0, 1.62, −3), the open-panel centre (+2, 1.62, 4.0), and the terrace looking back. Then pin a window larger than the cap | Anchor at ≈ (+5.1, 1.45, 3.9) ±5 cm, 15° toward the room centre ±1°, in front of the closed panel x +4…+6. Pinned size 0.85×1.08 m ±2 cm. From the reveal point and the open-panel centre, the window's screen bounds don't overlap the open-panel region (x 0…+4); horizon and sun glitter (20–25° viewer-right of the view axis) unobstructed. No intersection with the panel frame or curtains. Oversized window scaled down to the cap with aspect kept; text size logged (X-18) |

## 5. Destructive and edge-case tests (DES)

| ID | Test | Pass criteria |
|---|---|---|
| DES-01 | Key mashing, 60 s, in WORLD, SCREEN and a focused Notes field | No crash, no stuck state, no unintended pin, close or state change |
| DES-02 | Hold `W A S D` + `Shift` + `Space` + `Q`, release in random order | Correct final state; no drift; no ghost keys |
| DES-03 | Alt-tab mid-drag (overlay) and **while carrying** | Drag ends cleanly; goes to RELEASED [Atlas §2.5]. Carried window behavior: OPEN X-15 (floor: not lost, still reachable via the tray) |
| DES-04 | Alt-tab while holding `W` | On return the player isn't walking |
| DES-05 | `Esc` spam: 30 presses in 5 s in WORLD, SCREEN, a focused Notes field and during a drag [Pixel asks] | Ends in a defined state; never cursor-hidden-but-not-looking, or cursor-visible-with-nothing-clickable |
| DES-06 | Rapid `Q`: 50 toggles in 10 s | Final state matches the last input; no orphan layers; handles lock rejections; counts back to baseline |
| DES-07 | "50 windows" | Single instance in Alpha [D-009], so 50 windows can't be opened: 50 rapid clicks per tile still leave exactly one window each. Stress instead with 50 open → pin → pick up → close cycles across all apps: usable throughout, memory back to baseline ±10%. Revisit when multi-instance arrives |
| DES-08 | Very long notes: paste 1 MB, then 6 MB; 100k lines; a single 50k-char line; emoji-heavy | Key→glyph ≤ 50 ms at 1 MB; 300 ms autosave doesn't jank while typing; **quota exceeded → the user is told and nothing is silently lost** (X-16 residual) |
| DES-09 | IME: Japanese, Chinese Pinyin, Korean | Correct commit; `Esc` during composition cancels the composition without also stepping down the `Esc` ladder; `Enter` during composition triggers nothing else |
| DES-10 | RTL, Devanagari, emoji picker (Win + . / Ctrl+Cmd+Space), combining marks | Render correctly in overlay and pinned Notes (font fallback beyond Atkinson Hyperlegible) |
| DES-11 | Browser zoom 50/90/125/200% | Hit-testing correct; canvas not mis-sized; record whether zoom changes the world size of pinned windows (520 px/m of CSS px) and so the RUL-14 text size |
| DES-12 | Trackpad only (Windows precision, macOS) | Look, click, drag, resize, scroll Notes all possible; two-finger scroll doesn't move or zoom the world; macOS three-finger drag works; drag-to-look fallback usable |
| DES-13 | **AZERTY / non-QWERTY bindings** | Movement on physical ZQSD works on every browser (`code` matching); the Screen key is the physical `KeyQ` position (labelled "A" on AZERTY) and works. Hint labels are covered by RUL-19. Firefox/Safari wrong labels are a known limitation [Plan #19], logged once as `NON-GATING`, not re-reported |
| DES-14 | **Italian** layout | `W A S D` in place; in Notes, è à ò ù ì and AltGr combos (AltGr+ò = @, AltGr+è = [) type correctly; on Windows AltGr = Ctrl+Alt triggers no shortcut. `/` for the launcher: on Italian "/" is Shift+7 (`Digit7`), so check whether the `/` binding is reachable |
| DES-15 | German QWERTZ, US-International dead keys | Dead-key sequences type correctly; `F6` on laptops needing `Fn` |
| DES-16 | Refresh mid-session: mid-type (< 300 ms after the last key), mid-drag, while carrying, while pinned | No crash; the last keystrokes survive (debounce flush on `pagehide`/`visibilitychange`); pinned restored, carried comes back as overlay [D-009, Atlas §3] |
| DES-17 | Browser-reserved shortcuts: Ctrl+W/T/N/Tab/L | Never bound [Pixel §1.3]; Ctrl+W right after typing loses nothing (see DES-16) |
| DES-18 | Drag-select text in Notes and release over the world | Must NOT count as "click on empty world" and re-lock (drag guard) [Pixel §1.2] |
| DES-19 | Right, middle, back/forward mouse buttons; browser Back | No broken state; Back doesn't silently drop unsaved state |
| DES-20 | Two Ghiland tabs | No storage corruption (last-write-wins race on `ghiland:app:notes`); audio behavior recorded |
| DES-21 | Tab switch during load [Pixel asks] | Loading continues; return lands in a correct state; audio per AUD-10 |
| DES-22 | 8 h idle, tab visible | Responsive; heap in budget; the ambient scheduler hasn't drifted or stacked events |

---

## 6. Browser / device matrix

**Gates [D-013, Plan #20]: Chromium desktop (Chrome, Edge) gates sign-off. Firefox and Safari run the smoke test only; their issues are logged as `NON-GATING` and don't block Alpha 0.1.**

| Test set | Chrome Win, GATING (RTX 3060) | Edge Win, GATING | Chrome, informational tiers (Iris Xe, M1, 144 Hz) | Firefox Win + macOS | Safari macOS |
|---|---|---|---|---|---|
| Smoke (9.1) | every build | every build | weekly | **every build, smoke only** | **every build, smoke only (manual)** |
| Golden path (3) | 10× for sign-off | 3× | 1× per tier | inside the smoke run | inside the smoke run |
| Perf budgets (2.2) | **full, gating** | FPS, 1% low, load (gating) | 2.3 recording | — | — |
| 60-min soak | **gating** | — | once on Iris Xe (informational) | — | — |
| MOV / SCR / WIN / RUL (4.1–4.3, 4.7) | full | smoke subset + RUL-16/19 | golden-path subset | smoke | smoke |
| AUD (4.4) | full | subset | subset | smoke (includes beds playing, RUL-18f) | smoke (strictest autoplay) |
| BRK / DES / A11Y | full | BRK-01/03 | BRK-07 on Iris Xe | not run (issues seen are logged) | not run |

Firefox/Safari smoke run (manual unless automation is cheap): load, card click → sea audible, "Click to walk" locks the pointer, walk to the glass, `Q`, open Notes, type, detach, pin at `hero-sea`, walk away and back, reload → note persisted. Also check: Firefox's pointer-lock banner vs our hints [Pixel §1.3]; QWERTY hint labels (known limitation, RUL-19); re-lock cooldown measured and recorded [Pixel §9].

## 7. Accessibility (A11Y)

| ID | Check | Pass criteria (proposal where no spec) | Spec |
|---|---|---|---|
| A11Y-01 | Keyboard-only UI | Everything in SCREEN reachable: `Tab`/`Shift+Tab`, `F6`/`Shift+F6`, `/`, arrows, `Enter`/`Space`, `P`, `Esc`. Keyboard-only golden path = `Q` → `/` → Notes → type → `Esc` → `P` → `E` (carry) → `E` (put down). Moving/resizing windows by keyboard is a documented limitation, not a bug | Pixel §7 |
| A11Y-02 | Focus visibility | 2 px accent ring with a 1 px offset on every focusable element via `:focus-visible`; accent ≥ 3:1 on `surface` | Pixel §6.7, §7 |
| A11Y-03 | Contrast | Overlay `text-1` ≥ 4.5:1 (spec claims ~11:1), `text-2` ≥ 4.5:1 (claims ~5.5:1) over worst-case white. World windows ≥ 4.5:1 through the emissive clamp, measured from screenshots at the **terrace balustrade spot facing the sun**, the hero spot, and at night after Slow sunset | Pixel §6.7, §7; Aura §6 |
| A11Y-04 | Reduced motion | OS preference and the in-app toggle: transforms become 120 ms fades, fly-to becomes fade out/in, no idle breathing, walk motion or turn lag | Pixel §6.5, §7; Aura §5 |
| A11Y-05 | In-world text legibility | Measured per RUL-14 (≥ 14 px body text at 1.75 m, 1080p, FOV 62°). Plus a human check: a tester reads a 3-line Notes paragraph aloud without errors at 1.75 m head-on and at 45° oblique, at `hero-sea` and at the terrace balustrade (brightest spot) | Plan #14, Pixel §6.1, Aura §6 |
| A11Y-06 | Audio → visual | Alpha audio carries no essential information except possible UI ticks, which have visual equivalents. Captions `PENDING SPEC` (X-17) | — |
| A11Y-07 | Comfort options | Sensitivity, invert Y and drag-to-look exist; FOV per X-06 | Pixel §5.1, §7 |
| A11Y-08 | Screen reader (NVDA, VoiceOver) | Each window is `role="region"` with an app-name label; hints announced through a polite live region; Notes is an editable, labelled field. The world not being described is a known limitation | Pixel §7 |
| A11Y-09 | Photosensitivity | Nothing flashes > 3×/s: lighthouse sweep, sun glitter, spray, bloom, exposure dips | quality floor |

---

## 8. Product critique rubric

Scored 1–5 by Sentinel plus **≥ 3 first-time testers** who haven't seen Ghiland and get only the URL. A score without its evidence is discarded.
Anchors: **1** fails (tester says so or quits) · **2** weak, obvious problems · **3** acceptable, forgettable · **4** good, praised unprompted · **5** memorable, tester wants to show someone.

| # | Question | Evidence required | When |
|---|---|---|---|
| C1 | Is it relaxing? | Self-rating plus observed behavior: slows down, stops at the glass, looks out unprompted. Timestamped list of startle moments (sound spikes, exposure jumps, camera jolts) | min 1, 10, 60 |
| C2 | Premium? | Screenshots V1–V8 plus video; tally against Aura's "never" list [Aura §1] and anti-demo checklist; UI jank count; foliage and thin-edge aliasing per tier (RUL-17) | min 1, 10 |
| C3 | Intuitive in the first 60 s without instructions? | Think-aloud recording: time to first move, lock, reveal, glass, Screen; count of "how do I…?" moments. Aura target: "wow" within ~15 s of spawn. Pixel test: pins **and** carries a window with hints only | min 1 (and to 3 min for the pin/carry test) |
| C4 | Genuinely different from opening Chrome? | Verbatim answers to "What could you do here that you couldn't in a normal tab?" and "Would you rather write notes here or in a normal tab, and why?" Did "Okay. This is different." (or equivalent) happen: yes/no | min 10 |
| C5 | Would someone stay an hour? | 60-min session with a real task (writing, reading, idling); log attention drift, phone checks, the moment they'd close it; "Would you open this tomorrow?" | min 60 |
| C6 | What's left after the novelty? | The same three questions at min 1, 10, 60: "What do you notice now?", "What's annoying you?", "What would you miss if it were gone?" Plot C1–C4 over time; a drop of ≥ 2 points from min 1 to 60 is flagged | min 1, 10, 60 |
| C7 | Does each element add immersion or clutter? | Element audit below, per build | min 10 |

Element audit, one row per visible or audible element (Screen, shelf, Notes, pinned window, far card, pin tag, reticle dot, hints, loading backdrop, each ambient layer, footsteps, dust, gulls, sailboat, curtains, exposure adaptation, debug leftovers):

| Element | Immersion / Neutral / Clutter | Evidence (quote, timestamp, screenshot) | Remove test: does anyone notice when it's hidden? |
|---|---|---|---|

Sentinel reports scores and evidence. Any suggestion goes on a separate "observation" line to the owner, never as a redesign.

---

## 9. Test automation proposal

### 9.1 Scripted with Playwright (Chromium)

| Suite | Content | Gate | Notes |
|---|---|---|---|
| **Unit (Vitest, Forge-owned)** | Input state machine as a table test of every transition in Pixel §1.2 and Atlas §2.5; window mode transitions table [Atlas §2.4]; owner stack push/pop [Atlas §2.5]; placement rule (35°/horizontal/none); projector math; store migrations and corrupt-blob handling; collision boxes | every PR | Atlas already plans Vitest for migrations, projector, collision, input |
| **Smoke** (~2 min, every build) | Load → 0 console errors/failed requests → WebGL2 context → Seaside click → wait for `world:entered` → hook-driven walk forward 2 s, assert position changed → `Q` → Notes → type → assert no movement → detach/pin via real input where possible, hook otherwise → walk → assert pinned transform unchanged → reload → assert note persisted | build acceptance | Extends Atlas's planned smoke test. Headless (SwiftShader) is OK for functional checks, **never** for perf |
| **Perf capture** (every build, self-hosted runner on the GATING machine, RTX 3060, headed, fullscreen, Chrome + Edge) | Forced HIGH; fixed camera path via hook; rAF sampler → avg, 1% low, spikes; PerfHud stats at V1–V8, including GPU memory with render targets; CDP `Performance.getMetrics`; CDP `Tracing` around summon/open/detach/pin/anchor snap/tier change; cold-load run with `Network.emulateNetworkConditions`; HAR for payload; RUL-14 calibration-bar screenshot at 1.75 m | Gates in 2.2; > 10% regression vs the last accepted build flagged | Real GPU only. Weekly job on the informational tiers (2.3) |
| **Heap soak** (nightly, 60 min) | Loop: walk 2 min → `Q` ×5 → open Notes, type 500 chars, detach, pin, grab, put down, close ×3 → idle 1 min. Every 60 s: forced GC + `JSHeapUsedSize` + `Nodes` + renderer memory + decoded-audio bytes. Heap snapshots at t=5 and t=60 | growth budgets | CSV + chart per run |
| **Asset failure** | `page.route` aborts (BRK-09); offline (BRK-11); storage corruption injection (BRK-13) | no scene-killing errors | |
| **Context loss** | `loseContext`/`restoreContext` via `page.evaluate` | per Atlas once specified | |
| **Bundle** | `next build` + size-limit per chunk budget; analyzer report archived; assert no three.js in the landing chunk | every PR | |
| **Lighthouse CI** | Landing route only (Lighthouse doesn't meaningfully measure the WebGL scene) | LCP/TBT | |

Caveats: pointer lock and raw `movementX` are unreliable in automation, so look and placement go through the test hook. Screenshot diffing of the live world is too flaky with animated ambience; use it only for static UI states with an "ambient freeze" debug flag.

### 9.2 Manual only

Movement feel and nausea (MOV-12/13); audio by ear (AUD-02/03/04/06/11/13); first-time user sessions and the whole rubric (section 8); IME, layouts, trackpads (DES-09 to DES-15); Safari runs; real GPU crash; multi-monitor DPR drags; screen readers; contrast against live renders; swim test video review (WIN-20); detach/snap misfire trials (WIN-04).

---

## 10. Entry and exit criteria

### 10.1 Entry: Forge provides, or the build is returned

- [ ] Preview URL **or** exact run command for a **production** build, plus Node/pnpm versions
- [ ] Commit SHA, branch, changelog since the last build
- [ ] Known-issues list (not re-reported, but still counted against exit criteria)
- [ ] Which spec revisions the build implements, and how it handles the remaining OPEN items (X-06, X-15, X-17, X-18, X-19, X-20)
- [ ] **PerfHud toggle** (Atlas `togglePerfHud`; key documented), off by default, showing FPS, frame-time graph, draw calls, triangles, geometries, textures, estimated texture MB, JS heap, resolved tier and DPR, player position, active voices, input state
- [ ] Forced quality tier from Settings, plus a URL override for automation
- [ ] Test hooks in test builds only (inert in prod): `window.__ghiland` with player transform get/set, camera-path runner, renderer.info snapshot, window registry with world transforms and modes, input state, audio context state, decoded audio bytes, ambient event log, `performance.mark` at entry click and `world:entered`
- [ ] Asset manifest with compressed sizes
- [ ] Smoke suite passes. Failing GP-1 to GP-5 means the build goes back without a full pass
- [ ] **Greybox checkpoint (after Forge step 1, per the Master plan):** a reduced entry of URL/command, commit, and a PerfHud with FPS + input state. Sentinel runs MOV-01…MOV-16, SCR-01/02/03, DES-02/04/05/06 and RUL-15e (glass blocks movement), and reports before anything builds on it
- [ ] **Step-7 build:** RUL-13, RUL-14 (the ruling requires this measurement), RUL-15 and RUL-21 run as soon as carry/pin lands, before the art pass

### 10.2 Exit: Alpha 0.1 sign-off (PROPOSAL)

- [ ] Remaining OPEN items (X-06, X-15, X-17, X-18, X-19, X-20) decided or explicitly deferred by Master, and every `PENDING` expectation filled in and executed
- [ ] 0 open BLOCKERs
- [ ] 0 open MAJORs on golden-path areas (GP steps, MOV-08/09/10/12, WIN-04/05/16/20/21, AUD-01/02/04, LOAD-04); other MAJORs only with an owner and Francesco's written waiver
- [ ] Golden path 10/10 in Chrome and 3/3 in Edge on the GATING tier. Firefox/Safari smoke results attached (non-gating) [D-013]
- [ ] Gating budgets (2.2) met in Chrome on the GATING tier at HIGH, plus the FPS/1% low/load subset in Edge (and the thermal run if the reference is a laptop), or waived in writing. Informational tiers recorded per 2.3
- [ ] All RUL-13…RUL-21 pass, with RUL-14 measured on the step-7 build
- [ ] 60-min soak passes (heap, GPU resources, DOM, decoded audio)
- [ ] Rubric: ≥ 3 first-time testers; average ≥ 3.5 across C1–C6; nothing averaging ≤ 2; C4 ≥ 4 (it is the product thesis); ≥ 2 of 3 complete the golden path in ≤ 3 min with hints only
- [ ] A11Y-01/02/03/05/09 pass; the rest recorded
- [ ] Final report: open issues, waivers, per-browser status

---

## 11. Open questions

Answered since v0.1, so removed: reference hardware (D-015), Firefox/Safari gating (D-013), budgets until measured (Plan #20), entry flow, anchors, pinned scale, occlusion, foliage AA, audio memory, key hints (Plan #13–19).

For Francesco:
1. **Exact reference machine:** do we have an RTX 3060-class machine (desktop or laptop) for the gating runs and the self-hosted perf runner? Desktop or laptop matters for the thermal run.
2. **Refresh rate:** is "60 fps on HIGH" measured vsync-locked at 60 Hz (as proposed), or must it also hold uncapped on 120/144 Hz monitors?
3. **Load-time network:** confirm 50 Mbps / 20 ms RTT cold cache as the basis for the 8 s gate.
4. **First-time testers:** who are the ≥ 3 people, and do you accept the rubric exit bar (average ≥ 3.5, C4 ≥ 4)?
5. **Waivers:** who can waive a missed budget or an open MAJOR (you, or Master)?
6. **Accessibility bar:** is screen-reader support in scope for Alpha 0.1, or recorded only?

For Master:
7. X-06: does the FOV setting (55–75°) ship in Alpha 0.1? Plan #14 implies yes; Pixel §7 says no.
8. X-18: at `hero-sea`, should an oversized window be scaled down (breaking ≥ 14 px) or keep 520 px/m and overflow the cap?
9. X-19: what happens when a second window is pinned to an occupied anchor?
10. X-20: horizontal pin pose (tilted 12° vs flat), and whether a ray through glass may pin on a surface behind it.
11. X-15 / X-17: carried window on lock loss; context-loss recovery; mobile behavior; UI sounds; mute; captions.

## SUMMARY
v0.2 of the Alpha 0.1 QA and performance test plan for Seaside House. It folds in Master's rulings (Plan #13–22, D-010…D-015) and the user's hardware override. All ruled conflicts are now resolved, each with a verification test (RUL-13…RUL-21). Budgets are re-based on a dedicated-GPU gating tier (RTX 3060/3070 class, 1080p, HIGH, 60 fps, 1% low ≥ 50), with Iris Xe and M1 as informational tiers. Chromium gates sign-off; Firefox and Safari are smoke-only. Six minor items remain open, three of them new findings from Pixel Rev 2 and Atlas.

## WHAT WAS DONE
Read ALPHA_0.1_PLAN.md items 13–22, DECISIONS.md D-010…D-015, and the revised ATLAS_ARCHITECTURE.md (22:35), AURA_WORLDS.md (22:38) and PIXEL_UI_SYSTEM.md Rev 2 (22:40). Moved X-03, X-04, X-09, X-10, X-11, X-12, X-13, X-14 to resolved; added section 4.7 with one test per ruling; rewrote section 2 (gating/informational tiers, GPU memory now includes MSAA render targets), the golden path steps affected (entry, Notes 440×560, anchor pin, glass visibility), the browser matrix, and entry/exit criteria; added section 11 (open questions).

## FILES / SYSTEMS AFFECTED
docs/qa/ALPHA_0.1_TEST_PLAN.md only. No other files touched.

## IMPORTANT DECISIONS
Recorded, not made by Sentinel: D-010…D-015 and Plan #13–22. User override D-015: dedicated-GPU gating tier. Master is being informed, and it's already logged as D-015. Proposed by Sentinel: measure the gating tier on the RTX 3060 (worst in class); gating ceilings = Atlas HIGH (≤ 150 draw calls, ≤ 750k triangles, ≤ 256 MB GPU memory including MSAA targets, heap ≤ 400 MB) with Aura's stricter numbers as non-gating targets; frame-spike, hitch and leak thresholds; RUL tolerances (anchor ±1 cm / ±1°, pinned size ±2 cm); `NON-GATING` tag for Firefox/Safari/informational-tier issues.

## RISKS
- GPU memory: MSAA 4× composer targets likely cost ~100–130 MB at 1080p on their own (Sentinel estimate, half-float buffers), leaving little room under 256 MB for Aura's up-to-150 MB of textures; at DPR > 1 it grows ~2.25× or more.
- X-18: the hero-sea size cap can push pinned text below the 14 px ruling if the user resized Notes first.
- X-20: a ray through glass could pin a window outside on the terrace.
- Streamed beds: a media-element crossfade seam or a slow-network stall could make the sea, the most important sound, glitch (RUL-18).
- Real-time sun shadows through the 12 m glass wall plus MSAA 4× may still miss the 1% low ≥ 50 gate on an RTX 3060.
- Iris Xe users (the non-gating tier) may get a noticeably weaker experience; only "graceful degradation" is required.

## KNOWN LIMITATIONS
No build exists; nothing has been executed or measured. The docs changed several times during drafting; v0.2 reflects the files as read between 22:39 and 22:41. GPU memory in the browser can only be estimated. The 14 px figure is Atlas's calculation until RUL-14 measures it.

## RECOMMENDED NEXT ACTION
Francesco answers section 11 questions 1–3 (reference machine, refresh rate, network) so the perf runner can be set up before Forge step 3. Master rules on X-06, X-18, X-19 and X-20 (all touch the pin step of the golden path). Forge ships the PerfHud (with render-target memory), `window.__ghiland` hooks and the Notes calibration bar by step 7. Sentinel runs the greybox checkpoint, then RUL-13/14/15/21 on the step-7 build.
