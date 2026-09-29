/**
 * Copy three.js KTX2, Draco, and meshopt decoders into public/ so the static
 * host can serve them. URLs are /decoders/... and the production base path
 * prefixes them to /ghiland/decoders/...
 */
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libs = join(root, 'node_modules/three/examples/jsm/libs');
const dest = join(root, 'public/decoders');

function copyFile(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

copyFile(join(libs, 'basis/basis_transcoder.js'), join(dest, 'basis/basis_transcoder.js'));
copyFile(join(libs, 'basis/basis_transcoder.wasm'), join(dest, 'basis/basis_transcoder.wasm'));

for (const name of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  copyFile(join(libs, 'draco', name), join(dest, 'draco', name));
  copyFile(join(libs, 'draco/gltf', name), join(dest, 'draco/gltf', name));
}

copyFile(join(libs, 'meshopt_decoder.module.js'), join(dest, 'meshopt/meshopt_decoder.module.js'));
