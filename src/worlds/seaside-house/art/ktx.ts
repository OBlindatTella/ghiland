import type { WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { DECODER_PATHS, prefixPublicUrl } from '@/deploy/basePath';

let loader: KTX2Loader | null = null;

/** One Basis transcoder from the shared decoder set. detectSupport again after a context restore. */
export function seasideKtx2(gl: WebGLRenderer): KTX2Loader {
  if (!loader) {
    loader = new KTX2Loader();
    loader.setTranscoderPath(prefixPublicUrl(DECODER_PATHS.ktx2));
  }
  loader.detectSupport(gl);
  return loader;
}
