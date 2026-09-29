import {
  BasicShadowMap,
  Group,
  Mesh,
  PCFSoftShadowMap,
  PlaneGeometry,
  type Camera,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import type { QualityTier } from '@/contracts/quality';
import { qualityProfiles } from '@/engine/quality/profiles';

/** Tiers AUTO can reach. ULTRA is manual only (D-041). */
export const AUTO_SHADER_TIERS: readonly QualityTier[] = ['LOW', 'MED', 'HIGH'];

export type FoliageWarmup = 'alphaTest' | 'alphaToCoverage' | 'alphaHash';

interface ShaderCompiler {
  shadowMap: { enabled: boolean; type: number };
  compile: (scene: Object3D, camera: Camera) => unknown;
  compileAsync: (scene: Object3D, camera: Camera) => Promise<unknown>;
}

const kept: Material[] = [];
let geometry: PlaneGeometry | null = null;

export function releaseWarmedMaterials(): void {
  for (const material of kept) material.dispose();
  kept.length = 0;
  geometry?.dispose();
  geometry = null;
}

function collectMaterials(root: Object3D): Material[] {
  const found: Material[] = [];
  const seen = new Set<Material>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || mesh.userData.warmup) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (!material || seen.has(material) || material.userData.warmup) continue;
      seen.add(material);
      found.push(material);
    }
  });
  return found;
}

function foliageModes(tier: QualityTier): FoliageWarmup[] {
  if (tier === 'HIGH') return ['alphaToCoverage', 'alphaHash'];
  return ['alphaTest'];
}

function applyFoliage(material: Material, mode: FoliageWarmup): void {
  const leaf = material as MeshStandardMaterial;
  if (mode === 'alphaHash') {
    leaf.alphaTest = 0;
    leaf.alphaToCoverage = false;
    leaf.alphaHash = true;
  } else if (mode === 'alphaToCoverage') {
    leaf.alphaTest = 0.35;
    leaf.alphaToCoverage = true;
    leaf.alphaHash = false;
  } else {
    leaf.alphaTest = 0.4;
    leaf.alphaToCoverage = false;
    leaf.alphaHash = false;
  }
  leaf.needsUpdate = true;
}

/**
 * Compile the live scene's materials for every tier AUTO can reach.
 * Clones stay referenced so three's program cache is not released when the
 * live material later swaps shadow type or foliage mode (S6-05).
 */
export async function warmSceneShaders(gl: ShaderCompiler | WebGLRenderer, scene: Object3D, camera: Camera): Promise<void> {
  const compiler = gl as ShaderCompiler;
  const materials = collectMaterials(scene);
  if (!geometry) geometry = new PlaneGeometry(1, 1);
  const saved = { enabled: compiler.shadowMap.enabled, type: compiler.shadowMap.type };
  try {
    for (const tier of AUTO_SHADER_TIERS) {
      const profile = qualityProfiles[tier];
      compiler.shadowMap.enabled = profile.shadows !== 'off';
      compiler.shadowMap.type = profile.shadows === 'soft' ? PCFSoftShadowMap : BasicShadowMap;
      for (const mode of foliageModes(tier)) {
        const group = new Group();
        group.name = 'shader-warmup';
        group.userData.warmup = true;
        for (const material of materials) {
          const clone = material.clone();
          clone.userData = { ...material.userData, warmup: true, tier, foliage: mode };
          if (clone.userData.role === 'foliage') applyFoliage(clone, mode);
          kept.push(clone);
          const mesh = new Mesh(geometry, clone);
          mesh.userData.warmup = true;
          mesh.frustumCulled = false;
          mesh.position.set(0, -1000, 0);
          group.add(mesh);
        }
        scene.add(group);
        compiler.compile(scene, camera);
        await compiler.compileAsync(scene, camera);
        scene.remove(group);
      }
    }
  } finally {
    compiler.shadowMap.enabled = saved.enabled;
    compiler.shadowMap.type = saved.type;
  }
}
