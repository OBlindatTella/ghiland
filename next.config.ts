import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * GitHub Pages project site: https://oblindattella.github.io/ghiland/
 * `basePath` must not end with a slash. An empty `assetPrefix` is rewritten to
 * `basePath` by Next; set both so `/_next` files are requested under `/ghiland`.
 * Dev stays at `/` so local play is unchanged.
 */
const PAGES_BASE_PATH = '/ghiland';

export default function nextConfig(phase: string): NextConfig {
  const basePath = phase === PHASE_DEVELOPMENT_SERVER ? '' : PAGES_BASE_PATH;
  return {
    output: 'export',
    basePath,
    assetPrefix: basePath,
    trailingSlash: basePath !== '',
    images: { unoptimized: true },
    env: {
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
  };
}
