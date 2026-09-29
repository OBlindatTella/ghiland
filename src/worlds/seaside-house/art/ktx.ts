import type { WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

let loader: KTX2Loader | null = null;

/** One Basis transcoder, self-hosted under public/basis. detectSupport again after a context restore. */
export function seasideKtx2(gl: WebGLRenderer): KTX2Loader {
  if (!loader) {
    loader = new KTX2Loader();
    loader.setTranscoderPath('/basis/');
  }
  loader.detectSupport(gl);
  return loader;
}
