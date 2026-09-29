import {
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
  type Material,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { QualityTier } from '@/contracts/quality';
import { BOULDERS, CLIFF_UNDER, COVE_ARM_LEFT, COVE_ARM_RIGHT, WET_SHELVES, type PlacedModel } from './cove';
import { headlandCliffs } from './headland';
import { seasideKtx2 } from './ktx';

const MODEL_ROOT = '/assets/seaside/models';
const buffers = new Map<string, ArrayBuffer>();

export interface NatureHandle {
  group: Group;
  dispose: () => void;
}

/** Transcoded RGBA8 plus mips for the cliff/rock sets and the two water normals. */
export function natureTextureBytes(tier: QualityTier): number {
  const map = 1024 * 1024 * 4 * (4 / 3);
  const water = 512 * 512 * 4 * (4 / 3);
  const models = tier === 'LOW' ? 4 : 5;
  return models * 3 * map + 2 * water;
}

function modelUrl(asset: PlacedModel['asset'], tier: QualityTier): string {
  const suffix = tier === 'LOW' ? '-low' : '';
  return `${MODEL_ROOT}/${asset}${suffix}.glb`;
}

async function cachedBuffer(url: string): Promise<ArrayBuffer> {
  const existing = buffers.get(url);
  if (existing) return existing;
  const response = await fetch(url);
  if (!response.ok) throw new Error(url);
  const buffer = await response.arrayBuffer();
  buffers.set(url, buffer);
  return buffer;
}

function parseGltf(gl: WebGLRenderer, buffer: ArrayBuffer): Promise<Group> {
  const loader = new GLTFLoader();
  loader.setKTX2Loader(seasideKtx2(gl));
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((resolve, reject) => {
    loader.parse(buffer.slice(0), MODEL_ROOT, (gltf) => resolve(gltf.scene), reject);
  });
}

function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.isMesh) found.push(mesh);
  });
  return found;
}

function tuneRock(material: Material): void {
  if (!(material instanceof MeshStandardMaterial)) return;
  material.color.set('#B7AA98');
  material.side = DoubleSide;
  material.roughness = Math.min(material.roughness, 0.92);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeasideWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSeasideWorld = worldPosition.xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeasideWorld;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           float seasideWave = sin(vSeasideWorld.x * 0.17 + vSeasideWorld.z * 0.11) * 0.15;
           if (vSeasideWorld.y < -5.4 + seasideWave) diffuseColor.rgb *= 0.55;
         }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         {
           float seasideWave = sin(vSeasideWorld.x * 0.17 + vSeasideWorld.z * 0.11) * 0.15;
           if (vSeasideWorld.y < -5.4 + seasideWave) roughnessFactor = 0.25;
         }`,
      );
  };
  material.customProgramCacheKey = () => 'seaside-wet-rock';
  material.needsUpdate = true;
}

function placeMesh(source: Mesh, piece: { position: readonly number[]; rotation: readonly number[]; scale: readonly number[] }): Mesh {
  const mesh = new Mesh(source.geometry, source.material);
  mesh.position.set(piece.position[0]!, piece.position[1]!, piece.position[2]!);
  mesh.rotation.set(piece.rotation[0]!, piece.rotation[1]!, piece.rotation[2]!);
  mesh.scale.set(piece.scale[0]!, piece.scale[1]!, piece.scale[2]!);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function placeInstances(source: Mesh, pieces: readonly PlacedModel[]): InstancedMesh {
  const mesh = new InstancedMesh(source.geometry, source.material, pieces.length);
  const dummy = new Object3D();
  pieces.forEach((piece, index) => {
    dummy.position.set(piece.position[0], piece.position[1], piece.position[2]);
    dummy.rotation.set(piece.rotation[0], piece.rotation[1], piece.rotation[2]);
    dummy.scale.set(piece.scale[0], piece.scale[1], piece.scale[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

async function loadModel(gl: WebGLRenderer, asset: PlacedModel['asset'], tier: QualityTier): Promise<Group> {
  const buffer = await cachedBuffer(modelUrl(asset, tier));
  return parseGltf(gl, buffer);
}

export async function loadSeasideNature(gl: WebGLRenderer, tier: QualityTier): Promise<NatureHandle> {
  const low = tier === 'LOW';
  const [under, arm, waterline, boulders, shelves] = await Promise.all([
    loadModel(gl, 'coastal_cliff_02', tier),
    loadModel(gl, 'coastal_cliff_01', tier),
    loadModel(gl, 'coastal_cliff_04', tier),
    loadModel(gl, 'coast_rocks_05', tier),
    low ? Promise.resolve(null) : loadModel(gl, 'coast_land_rocks_03', tier),
  ]);
  const sources = [under, arm, waterline, boulders, shelves].filter((group): group is Group => group !== null);
  const materials = new Set<Material>();
  const geometries = new Set<BufferGeometry>();
  for (const source of sources) {
    for (const mesh of meshesOf(source)) {
      geometries.add(mesh.geometry);
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        materials.add(material);
        tuneRock(material);
      }
    }
  }
  const group = new Group();
  group.name = 'seaside-nature';
  const singles: { source: Group; pieces: { position: readonly number[]; rotation: readonly number[]; scale: readonly number[] }[] }[] = [
    { source: under, pieces: [CLIFF_UNDER] },
    { source: arm, pieces: [COVE_ARM_LEFT, COVE_ARM_RIGHT] },
    { source: waterline, pieces: headlandCliffs() },
  ];
  for (const entry of singles) {
    for (const mesh of meshesOf(entry.source)) {
      for (const piece of entry.pieces) group.add(placeMesh(mesh, piece));
    }
  }
  const rocks = low ? BOULDERS.slice(0, 2) : BOULDERS;
  for (const mesh of meshesOf(boulders)) group.add(placeInstances(mesh, rocks));
  if (shelves) {
    for (const mesh of meshesOf(shelves)) group.add(placeInstances(mesh, WET_SHELVES));
  }
  return {
    group,
    dispose: () => {
      group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          material.map?.dispose();
          material.normalMap?.dispose();
          material.roughnessMap?.dispose();
          material.metalnessMap?.dispose();
          material.aoMap?.dispose();
        }
        material.dispose();
      }
    },
  };
}
