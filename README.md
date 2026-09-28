# Ghiland

A browser-based first-person world. Alpha 0.1 through the Seaside greybox, the world selector, and the Screen.

## Run

```bash
pnpm install
pnpm dev
```

Open `/` or `/w/seaside-house`. Click the Seaside House card. When the corridor is live, click to walk.

| Key | Action |
|---|---|
| W A S D or arrows | Walk (`KeyboardEvent.code`) |
| Shift | Stroll faster (2.2 m/s) |
| Mouse | Look, while the pointer is locked |
| Q | Toggle WORLD and SCREEN |
| Esc | In WORLD, the browser unlocks and the Screen opens. In SCREEN, step back one layer, then "Click to walk" |
| / | Focus the launcher shelf |
| ` | Toggle the perf readout |
| M | Mute, while walking |
| Settings | On the Screen shelf: volume, mute, sensitivity, FOV, quality |

`pnpm test` runs the shell-state and collision tests. `pnpm lint` and `pnpm build` check the app.

Specs live in `/docs`. Build order is in `/docs/ROADMAP.md`.
