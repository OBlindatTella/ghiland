/** GitHub Pages project path. Empty during `next dev`. */
export const PAGES_BASE_PATH = '/ghiland';

/**
 * Root-absolute public files. The runtime prefixer and the CSS build rewrite
 * these so a production export works at `/ghiland` without editing world code.
 * KTX2 (Basis), Draco, and meshopt are copied from `three` at build time.
 */
export const PUBLIC_ROOTS = ['/worlds/', '/fonts/', '/decoders/', '/audio/', '/assets/'] as const;

export const DECODER_PATHS = {
  ktx2: '/decoders/basis/',
  draco: '/decoders/draco/',
  dracoGltf: '/decoders/draco/gltf/',
  meshopt: '/decoders/meshopt/meshopt_decoder.module.js',
} as const;

function splitSuffix(input: string): { pathname: string; suffix: string } {
  const cut = input.search(/[?#]/);
  if (cut === -1) return { pathname: input, suffix: '' };
  return { pathname: input.slice(0, cut), suffix: input.slice(cut) };
}

export function prefixPublicUrl(
  input: string,
  base = process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  origin?: string,
): string {
  if (!base || !input) return input;
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(input);
  if (!absolute && !input.startsWith('/')) return input;
  let url: URL;
  try {
    url = absolute ? new URL(input) : new URL(input, origin ?? 'http://assets.local');
  } catch {
    return input;
  }
  if (absolute && origin && url.origin !== origin) return input;
  const path = url.pathname;
  if (path === base || path.startsWith(`${base}/`)) return input;
  if (!PUBLIC_ROOTS.some((root) => path.startsWith(root))) return input;
  url.pathname = `${base}${path}`;
  if (input.startsWith('/')) return `${url.pathname}${url.search}${url.hash}`;
  return url.toString();
}

/** App routes used with `history.pushState`. Directory URLs keep a trailing slash. */
export function prefixAppRoute(input: string, base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''): string {
  if (!base || !input.startsWith('/') || input.startsWith('//')) return input;
  const { pathname, suffix } = splitSuffix(input);
  if (pathname === base || pathname.startsWith(`${base}/`)) return input;
  if (pathname !== '/' && pathname !== '/w' && !pathname.startsWith('/w/')) return input;
  const next = `${base}${pathname}`;
  return `${next.endsWith('/') ? next : `${next}/`}${suffix}`;
}
