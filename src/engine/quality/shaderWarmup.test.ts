import { describe, expect, it } from 'vitest';
import { BasicShadowMap, Mesh, MeshStandardMaterial, PerspectiveCamera, PCFSoftShadowMap, Scene, type Material } from 'three';
import { AUTO_SHADER_TIERS, releaseWarmedMaterials, warmSceneShaders } from '@/engine/quality/shaderWarmup';

describe('shader warm-up', () => {
  it('compiles the real scene for every tier AUTO can reach, including both HIGH foliage modes', async () => {
    const scene = new Scene();
    const leaf = new MeshStandardMaterial({ alphaTest: 0.4 });
    leaf.userData.role = 'foliage';
    const plaster = new MeshStandardMaterial({ color: '#fff' });
    scene.add(new Mesh(undefined, leaf));
    scene.add(new Mesh(undefined, plaster));
    const camera = new PerspectiveCamera();
    const calls: Array<{ enabled: boolean; type: number; foliage: string[] }> = [];
    const gl = {
      shadowMap: { enabled: true, type: PCFSoftShadowMap },
      compile(root: Scene) {
        calls.push(snapshot(root, gl.shadowMap.enabled, gl.shadowMap.type));
      },
      async compileAsync(root: Scene) {
        calls.push(snapshot(root, gl.shadowMap.enabled, gl.shadowMap.type));
      },
    };
    await warmSceneShaders(gl, scene, camera);
    const modes = calls.map((call) => call.foliage.join('+'));
    expect(AUTO_SHADER_TIERS).toEqual(['LOW', 'MED', 'HIGH']);
    expect(modes).toContain('alphaTest');
    expect(modes).toContain('alphaToCoverage');
    expect(modes).toContain('alphaHash');
    expect(calls.some((call) => call.enabled === false)).toBe(true);
    expect(calls.some((call) => call.enabled && call.type === BasicShadowMap)).toBe(true);
    expect(calls.some((call) => call.enabled && call.type === PCFSoftShadowMap && call.foliage.includes('alphaHash'))).toBe(true);
    expect(calls.some((call) => call.foliage.includes('ultra'))).toBe(false);
    expect(scene.children.some((child) => child.name === 'shader-warmup')).toBe(false);
    releaseWarmedMaterials();
  });
});

function snapshot(root: Scene, enabled: boolean, type: number) {
  const foliage: string[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.userData.warmup) return;
    const material = mesh.material as Material & { userData: { role?: string; foliage?: string } };
    if (material.userData.role === 'foliage' && material.userData.foliage) foliage.push(material.userData.foliage);
  });
  return { enabled, type, foliage };
}
