# Ghiland

A browser-based first-person world. Alpha 0.1 steps 0 and 1: scaffold and a walkable Seaside House greybox.

## Run

```bash
pnpm install
pnpm dev
```

Open `/` or `/w/seaside-house`. Click the Seaside House card, then click the world to walk.

| Key | Action |
|---|---|
| W A S D or arrows | Walk (`KeyboardEvent.code`) |
| Shift | Stroll faster (2.2 m/s) |
| Mouse | Look, while the pointer is locked |
| Q | Toggle WORLD and SCREEN |
| Esc | In WORLD, the browser unlocks and the Screen opens. In SCREEN, step back to "Click to walk" |
| ` | Toggle the fps / draw call / triangle readout |

`pnpm test` runs the shell-state and collision tests. `pnpm lint` and `pnpm build` check the app.

Specs live in `/docs`. Build order is in `/docs/ROADMAP.md`.
