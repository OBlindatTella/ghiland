/**
 * GitHub Pages serves 404.html for unknown paths and keeps the URL.
 * The copy of the landing page boots the app for a deep link that was not
 * pre-rendered. Known worlds already have their own HTML.
 *
 * `npx serve out` serves this folder at `/`. The export's URLs start with
 * `/ghiland`, so a sibling copy under `out/ghiland` makes
 * http://localhost:3000/ghiland/ resolve. CI deletes that copy before upload.
 */
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = 'out';
const index = join(out, 'index.html');
if (!existsSync(index)) {
  console.error('pages-fallback: out/index.html is missing. Did next build finish?');
  process.exit(1);
}
copyFileSync(index, join(out, '404.html'));

const mirror = join(out, 'ghiland');
rmSync(mirror, { recursive: true, force: true });
mkdirSync(mirror);
for (const name of readdirSync(out)) {
  if (name === 'ghiland') continue;
  cpSync(join(out, name), join(mirror, name), { recursive: true });
}
