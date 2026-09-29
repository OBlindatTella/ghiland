# Ghiland

A browser-based first-person world. Alpha 0.1 through the Seaside greybox, the world selector, and the Screen.

Play: https://oblindattella.github.io/ghiland/

## How to play

Play it in the browser: [https://oblindattella.github.io/ghiland/](https://oblindattella.github.io/ghiland/)

Use a desktop Chromium browser (Chrome, Edge, Brave, or Arc) with a dedicated GPU. High quality is aimed at 60 fps on that kind of machine.

| Control | What it does |
|---|---|
| W A S D | Walk |
| Mouse | Look, after the pointer locks. Click the world to walk. |
| Q | Open and close the Screen |
| Drag a window past the edge of the Screen and hold | Carry it into the world |
| P | Pin the window where you are looking |
| Esc | In the world, the browser unlocks and the Screen opens. On the Screen, step back one layer, then "Click to walk". |

The public link appears after the game is merged to `main` and GitHub has finished the Pages deploy. The first time, someone has to turn Pages on. This checkout could not flip that switch: GitHub reports no Pages site for the repo, and this session cannot change repository settings.

1. Open the repo on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

After that, every push to `main` builds the game, runs the tests, and publishes the link above.

### On this computer

```bash
pnpm install && pnpm build && npx serve out
```

Open [http://localhost:3000/ghiland/](http://localhost:3000/ghiland/).

## Develop

```bash
pnpm install
pnpm dev
```

Open `/` or `/w/seaside-house`. `pnpm dev` is not the public base path. The static export is.

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

`pnpm test` runs the shell-state and collision tests. `pnpm lint` and `pnpm build` check the app. `pnpm build` writes a static site to `out/`. `next start` is not used.

Publishing details, decoder paths, and the Pages workflow are in `docs/DEPLOY.md`. Specs live in `/docs`. Build order is in `/docs/ROADMAP.md`.
