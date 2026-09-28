import type { BufferGeometry, Material, Object3D, Texture } from 'three';

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material) as unknown[]) {
    if (value && typeof value === 'object' && 'isTexture' in value) {
      (value as Texture).dispose();
    }
  }
  material.dispose();
}

export function disposeObject3D(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    mesh.geometry?.dispose();
    if (!mesh.material) return;
    if (Array.isArray(mesh.material)) mesh.material.forEach(disposeMaterial);
    else disposeMaterial(mesh.material);
  });
}
