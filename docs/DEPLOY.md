# Deploy

Ghiland is a static Next.js export. GitHub Pages serves it at [https://oblindattella.github.io/ghiland/](https://oblindattella.github.io/ghiland/).

## One-time setting

The workflow in `.github/workflows/pages.yml` deploys on every push to `main` (and when someone runs it by hand from the Actions tab). It uses `actions/upload-pages-artifact` and `actions/deploy-pages` with `contents: read`, `pages: write`, and `id-token: write`.

GitHub will not accept that deploy until the repo source is GitHub Actions:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

That switch was not set from this change. A read of the Pages API returned 404, so the repo has no Pages site yet, and the session that wrote this file cannot change repository settings. After the setting is on and this workflow is on `main`, the public link is the one above.

## What the build does

`next.config.ts` sets this for `pnpm build` (`next dev` leaves the base path empty):

| Setting | Value |
|---|---|
| `output` | `'export'` |
| `basePath` | `/ghiland` |
| `assetPrefix` | `/ghiland` |
| `trailingSlash` | `true` |
| `images.unoptimized` | `true` |

`assetPrefix` matches `basePath`. Next would copy an empty `assetPrefix` onto `basePath` anyway. Both are set so `/_next` files are requested as `/ghiland/_next/...`. Neither value has a trailing slash. `basePath` is rejected by Next if it ends with `/`.

There is no Node server in the export. The dynamic world route pre-renders `seaside-house`, `ny-balcony`, and `farm` (`generateStaticParams`, `dynamicParams: false`). The app does not use route handlers, middleware, cookies, or server actions. `pnpm start` serves the `out/` folder. `next start` does not apply.

`scripts/copy-decoders.mjs` runs before the build and copies three.js decoders into `public/decoders/`. `scripts/pages-fallback.mjs` copies `out/index.html` to `out/404.html` so GitHub Pages can still boot the app for an unknown path. `public/.nojekyll` is there so a branch deploy would not hide `_next`. The Actions deploy does not run Jekyll.

## Asset URLs

Next prefixes its own `/_next` files. It does not prefix files in `public/` or a string passed to `fetch`, `Audio`, or `history.pushState`.

Production builds set `NEXT_PUBLIC_BASE_PATH=/ghiland`. `src/deploy/BasePath.tsx` then prefixes:

- `/worlds/` audio and any later world files
- `/fonts/`
- `/decoders/` (KTX2 transcoder, Draco, meshopt)
- `/audio/` if a later pass adds that folder
- history routes `/` and `/w/...`, so entering the house stays on `/ghiland/w/seaside-house/`

A URL that already starts with `/ghiland` is left alone. CSS `url(/fonts/...)` is rewritten by `scripts/postcss-public-urls.mjs` during the production build. Dev CSS stays at `/fonts/...`.

Decoder files, served under the base path:

| Decoder | Path |
|---|---|
| KTX2 / Basis transcoder | `/decoders/basis/basis_transcoder.js` and `basis_transcoder.wasm` |
| Draco | `/decoders/draco/` (`draco_wasm_wrapper.js`, `draco_decoder.wasm`, `draco_decoder.js`) |
| Draco glTF build | `/decoders/draco/gltf/` |
| meshopt | `/decoders/meshopt/meshopt_decoder.module.js` (the wasm is inside the module) |

World code can keep writing `/decoders/basis/` or `/worlds/...`. The prefixer adds `/ghiland` in the exported site. `three`'s own `import.meta.url` decoder URLs, when a loader is bundled, already go out through `assetPrefix`.

## Local preview of the export

```bash
pnpm install && pnpm build && npx serve out
```

Open `http://localhost:3000/ghiland/`. The build copies the export into `out/ghiland/` so that command serves the same `/ghiland/...` URLs the public site uses. The GitHub Actions workflow deletes `out/ghiland` before upload, so the Pages artifact is the site root and the public URL is not `/ghiland/ghiland/`. `pnpm dev` is still `http://localhost:3000/`.
