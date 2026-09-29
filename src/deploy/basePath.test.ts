import { describe, expect, it } from 'vitest';
import { DECODER_PATHS, prefixAppRoute, prefixPublicUrl } from './basePath';

const base = '/ghiland';
const origin = 'http://127.0.0.1:4173';

describe('public asset base path', () => {
  it('prefixes audio, fonts, and decoder urls', () => {
    expect(prefixPublicUrl('/worlds/seaside-house/ocean.ogg', base)).toBe('/ghiland/worlds/seaside-house/ocean.ogg');
    expect(prefixPublicUrl('/worlds/seaside-house/wind.ogg', base)).toBe('/ghiland/worlds/seaside-house/wind.ogg');
    expect(prefixPublicUrl('/worlds/seaside-house/gull.ogg', base)).toBe('/ghiland/worlds/seaside-house/gull.ogg');
    expect(prefixPublicUrl('/fonts/atkinson-hyperlegible-400.woff2', base)).toBe(
      '/ghiland/fonts/atkinson-hyperlegible-400.woff2',
    );
    expect(prefixPublicUrl(`${DECODER_PATHS.ktx2}basis_transcoder.wasm`, base)).toBe(
      '/ghiland/decoders/basis/basis_transcoder.wasm',
    );
    expect(prefixPublicUrl(`${DECODER_PATHS.draco}draco_decoder.wasm`, base)).toBe(
      '/ghiland/decoders/draco/draco_decoder.wasm',
    );
    expect(prefixPublicUrl(`${DECODER_PATHS.dracoGltf}draco_wasm_wrapper.js`, base)).toBe(
      '/ghiland/decoders/draco/gltf/draco_wasm_wrapper.js',
    );
    expect(prefixPublicUrl(DECODER_PATHS.meshopt, base)).toBe('/ghiland/decoders/meshopt/meshopt_decoder.module.js');
    expect(prefixPublicUrl('/assets/seaside/hdri/syferfontein_18d_clear_puresky_1k.hdr', base)).toBe(
      '/ghiland/assets/seaside/hdri/syferfontein_18d_clear_puresky_1k.hdr',
    );
    expect(prefixPublicUrl('/assets/seaside/models/coastal_cliff_02.glb', base)).toBe(
      '/ghiland/assets/seaside/models/coastal_cliff_02.glb',
    );
  });

  it('prefixes a same-origin absolute url and leaves other hosts alone', () => {
    expect(prefixPublicUrl(`${origin}/decoders/basis/basis_transcoder.js`, base, origin)).toBe(
      `${origin}/ghiland/decoders/basis/basis_transcoder.js`,
    );
    expect(prefixPublicUrl('https://cdn.example/decoders/basis/basis_transcoder.wasm', base, origin)).toBe(
      'https://cdn.example/decoders/basis/basis_transcoder.wasm',
    );
  });

  it('does not double-prefix and stays a no-op without a base', () => {
    expect(prefixPublicUrl('/ghiland/worlds/seaside-house/ocean.ogg', base)).toBe('/ghiland/worlds/seaside-house/ocean.ogg');
    expect(prefixPublicUrl('/worlds/seaside-house/ocean.ogg', '')).toBe('/worlds/seaside-house/ocean.ogg');
    expect(prefixPublicUrl('/_next/static/chunks/app.js', base)).toBe('/_next/static/chunks/app.js');
  });

  it('prefixes history routes and keeps the directory slash', () => {
    expect(prefixAppRoute('/', base)).toBe('/ghiland/');
    expect(prefixAppRoute('/w/seaside-house', base)).toBe('/ghiland/w/seaside-house/');
    expect(prefixAppRoute('/w/seaside-house?x=1', base)).toBe('/ghiland/w/seaside-house/?x=1');
    expect(prefixAppRoute('/ghiland/w/farm/', base)).toBe('/ghiland/w/farm/');
    expect(prefixAppRoute('/w/seaside-house', '')).toBe('/w/seaside-house');
  });
});
