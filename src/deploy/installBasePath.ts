import { prefixAppRoute, prefixPublicUrl } from '@/deploy/basePath';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

let installed = false;

/**
 * Prefix public asset fetches and the two history calls the shell uses
 * (`/` and `/w/...`). Next.js already prefixes `/_next`. This runs after
 * Next patches `history`, so the prefixed route is what the app router sees.
 */
export function installBasePath(): void {
  if (installed || typeof window === 'undefined' || !BASE) return;
  installed = true;
  const origin = window.location.origin;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') return originalFetch(prefixPublicUrl(input, BASE, origin), init);
    if (input instanceof URL) return originalFetch(prefixPublicUrl(input.toString(), BASE, origin), init);
    if (input instanceof Request) {
      const nextUrl = prefixPublicUrl(input.url, BASE, origin);
      if (nextUrl !== input.url) return originalFetch(new Request(nextUrl, input), init);
    }
    return originalFetch(input, init);
  };

  const OriginalAudio = window.Audio;
  class PrefixedAudio extends OriginalAudio {
    constructor(src?: string) {
      super();
      if (typeof src === 'string') this.src = prefixPublicUrl(src, BASE, origin);
    }
  }
  window.Audio = PrefixedAudio;

  for (const method of ['pushState', 'replaceState'] as const) {
    const current = history[method].bind(history);
    history[method] = ((data: unknown, unused: string, url?: string | URL | null) => {
      const next = typeof url === 'string' ? prefixAppRoute(url, BASE) : url;
      return current(data, unused, next as string);
    }) as History['pushState'];
  }
}
