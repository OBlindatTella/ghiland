# Test hooks

`window.__ghiland` exists in development, and in a production build only when that build was started with `NEXT_PUBLIC_GHILAND_TEST_HOOKS=1`. A normal production build does not install the object. The methods below are the ones a runtime check can call. Older methods (`getShell`, `getPlayer`, `setPlayer`, `setQuality`, `getPerf`, and the rest) stay as they were.

## `setFakeFps(fps)`

Feeds the AUTO quality controller. `fps` is a number in frames per second, or `null` to read the live sample again.

While a number is set, AUTO uses it instead of the measured frame rate, including when the measured rate is still zero. That is how RUL-36c and RUL-36d can run on SwiftShader, where the real rate never climbs. `getPerf().fps` stays the measured value.

## `getExposure()`

Returns `{ exposure, zone }`. `exposure` is the current `toneMappingExposure` (corridor about 1.2, terrace or facing the glass toward 0.9). `zone` is the zone id the exposure director used for that frame (`corridor`, `terrace`, `interior`, or another authored id).

## `getRaySets()`

Returns `{ placement, occlusion, crosshair }` for the active world's box colliders. Each member is `{ id, layers }`.

- `placement` — colliders that block a placement ray (`movement` or `placement`).
- `occlusion` — colliders that fade a pinned window (`occluder` only).
- `crosshair` — colliders that block the crosshair (`occluder` only). Window quads are not in this list.

An empty world, or a world without box collision, returns three empty arrays.

## `getWindows()`

Returns one record per open window:

| Field | Meaning |
|---|---|
| `id` | Window id |
| `appId` | App id (`notes`, `chat`, …) |
| `state` | `normal`, `minimized`, or `maximized` |
| `mode` | `overlay`, `detached`, or `worldPinned` |
| `anchorId` | Pin anchor id when `mode` is `worldPinned` and one was stored, otherwise `null` |
| `minimized` | `state === 'minimized'` |
| `pinTag` | Whether a `[data-pin-tag]` element for this window is in the document |

## `getCarryFrames()` and `clearCarryFrames()`

`getCarryFrames()` returns the carry spring's position after each `stepCarry`, newest last, capped at 360 samples. Each sample is `{ id, position }` with `position` as `[x, y, z]`. Recording starts when the hook is installed and stops if the hook is disabled. `clearCarryFrames()` drops the samples already recorded.

## `injectMalformedPin()`

Appends a pinned record that cannot be parsed (no position, quaternion, or size) to `ghiland:windows`, keeping any records already in the file. The next read quarantines that record under `ghiland:windows:quarantine-…` and does not restore it.

## `armQuotaError()`

The next `localStorage.setItem`, and only that write, throws `QuotaExceededError`. The adapter catches it and reports a failed save. The write after that uses the original `setItem`.
