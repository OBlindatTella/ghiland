/**
 * Root-absolute urls in CSS are not prefixed by basePath. Rewrite the public
 * font (and any other public) urls during the production export only.
 */
const PUBLIC = /url\(\s*(['"]?)(\/(?:fonts|worlds|decoders|audio)\/)/g;

export default function publicUrls() {
  const base = process.env.NODE_ENV === 'production' ? '/ghiland' : '';
  return {
    postcssPlugin: 'ghiland-public-urls',
    Once(root) {
      if (!base) return;
      root.walkDecls((decl) => {
        if (!decl.value.includes('url(')) return;
        decl.value = decl.value.replace(PUBLIC, (_match, quote, path) => `url(${quote}${base}${path}`);
      });
    },
  };
}

publicUrls.postcss = true;
