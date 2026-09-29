'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  type Material,
  type InstancedMesh,
} from 'three';
import { releaseWarmedMaterials, trackGpuBytes, useResolvedFoliage, warmSceneShaders } from '@/engine';
import type { WorldSceneProps } from '@/contracts/world';
import { createCurtainMaterial } from './art/curtains';
import { environmentFromSky } from './art/environment';
import { rockLayout } from './art/rocks';
import { cloudLayers, curtainSegments, leafCount, oceanSegments, rockDetail, textureSizeForTier, vertexWaveCount, waveCount } from './art/scale';
import { shadowFrustum } from './art/shadowFit';
import { createOceanMaterial, createSkyMaterial } from './art/shaders';
import { cachedTextureSizes, cloneRepeat, estimateTextureBytes, retainTextureSize, seasideMaps, type SeasideMaps } from './art/textures';
import { FIG_AT, furnitureVisuals, type FurnishMaterial } from './furniture';
import { levelBoxes, SEA_Y } from './level';
import { sunDirection } from './sun';

const SUN = sunDirection(12, -22);

function fitShadow(light: DirectionalLight) {
  const camera = light.shadow.camera;
  camera.left = shadowFrustum.left;
  camera.right = shadowFrustum.right;
  camera.top = shadowFrustum.top;
  camera.bottom = shadowFrustum.bottom;
  camera.near = shadowFrustum.near;
  camera.far = shadowFrustum.far;
  camera.updateProjectionMatrix();
  light.shadow.bias = shadowFrustum.bias;
  light.shadow.normalBias = shadowFrustum.normalBias;
}

function SunLight({ shadows, mapSize }: { shadows: boolean; mapSize: number }) {
  const light = useRef<DirectionalLight>(null);
  const target = useRef<Object3D>(null);
  useLayoutEffect(() => {
    if (!light.current || !target.current) return;
    light.current.target = target.current;
    fitShadow(light.current);
  }, [shadows, mapSize]);
  return (
    <>
      <directionalLight
        ref={light}
        position={[SUN[0] * 40, SUN[1] * 40, SUN[2] * 40]}
        intensity={2.6}
        color="#FFC98F"
        castShadow={shadows}
        shadow-mapSize-width={mapSize || 1024}
        shadow-mapSize-height={mapSize || 1024}
      />
      <object3D ref={target} position={[0, 1.1, 0.4]} />
    </>
  );
}

function boxSize(min: readonly number[], max: readonly number[]): [number, number, number, number, number, number] {
  return [
    max[0]! - min[0]!,
    max[1]! - min[1]!,
    max[2]! - min[2]!,
    (min[0]! + max[0]!) / 2,
    (min[1]! + max[1]!) / 2,
    (min[2]! + max[2]!) / 2,
  ];
}

interface HouseMaterials {
  byKind: Record<string, Material>;
  glass: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  linen: MeshStandardMaterial;
  ceramic: MeshStandardMaterial;
  bronze: MeshStandardMaterial;
  leaf: MeshStandardMaterial;
  plasterDark: MeshStandardMaterial;
  dispose: () => void;
}

function buildHouseMaterials(maps: SeasideMaps, foliage: 'alphaTest' | 'alphaToCoverage' | 'alphaHash'): HouseMaterials {
  const owned: Material[] = [];
  const mapped = (source: SeasideMaps[keyof SeasideMaps], repeat: [number, number], color: string, roughness: number) => {
    const map = cloneRepeat(source, repeat[0], repeat[1]);
    const material = new MeshStandardMaterial({ map, color, roughness, metalness: 0 });
    owned.push(material, map as unknown as Material);
    return material;
  };
  const flat = (color: string, roughness: number, metalness = 0) => {
    const material = new MeshStandardMaterial({ color, roughness, metalness });
    owned.push(material);
    return material;
  };
  const travertineFloor = mapped(maps.travertine, [5, 3.5], '#ffffff', 0.84);
  const travertineDetail = mapped(maps.travertine, [1.2, 1.2], '#ffffff', 0.78);
  const oak = mapped(maps.oak, [1.5, 1], '#ffffff', 0.72);
  const plaster = mapped(maps.plaster, [2, 2], '#ffffff', 0.92);
  const plasterDark = mapped(maps.plaster, [1.4, 1.2], '#c9bfb2', 0.94);
  const teak = mapped(maps.teak, [4, 2.5], '#ffffff', 0.8);
  const rock = mapped(maps.rock, [1.5, 1.5], '#ffffff', 0.9);
  const leafMap = cloneRepeat(maps.leaf, 1, 1);
  const leaf = new MeshStandardMaterial({
    map: leafMap,
    alphaTest: foliage === 'alphaHash' ? 0 : foliage === 'alphaToCoverage' ? 0.35 : 0.4,
    alphaToCoverage: foliage === 'alphaToCoverage',
    alphaHash: foliage === 'alphaHash',
    roughness: 0.7,
    metalness: 0,
    side: 2,
    color: '#d7e2c8',
  });
  leaf.userData.role = 'foliage';
  owned.push(leaf, leafMap as unknown as Material);
  const glass = new MeshStandardMaterial({
    color: '#d7e6e8',
    roughness: 0.05,
    metalness: 0.04,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    envMapIntensity: 1.4,
  });
  const metal = flat('#d9d3c8', 0.35, 0.45);
  const linen = flat('#e6d5c0', 0.94);
  const ceramic = flat('#efe6da', 0.4, 0.05);
  const bronze = flat('#6e5a45', 0.42, 0.55);
  owned.push(glass);
  return {
    byKind: {
      travertineFloor,
      travertineDetail,
      oak,
      plaster,
      teak,
      rock,
      linen,
      ceramic,
      bronze,
    },
    glass,
    metal,
    linen,
    ceramic,
    bronze,
    leaf,
    plasterDark,
    dispose: () => {
      for (const item of owned) item.dispose();
    },
  };
}

function architectureKind(id: string): 'glass' | 'metal' | 'oak' | 'travertine' | 'travertineFloor' | 'teak' | 'plasterDark' | 'plaster' {
  if (id.startsWith('glass') || (id.startsWith('rail-') && id !== 'rail-cap-north')) return 'glass';
  if (id === 'rail-cap-north') return 'metal';
  if (id === 'soffit') return 'oak';
  if (id === 'fin' || id.startsWith('jamb')) return 'travertine';
  if (id === 'terrace-floor') return 'teak';
  if (id.endsWith('floor')) return 'travertineFloor';
  if (id.startsWith('corridor')) return 'plasterDark';
  return 'plaster';
}

function SkyDome({ clouds }: { clouds: number }) {
  const material = useMemo(() => createSkyMaterial(clouds), [clouds]);
  const mesh = useRef<Mesh>(null);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera, clock }) => {
    mesh.current?.position.copy(camera.position);
    material.uniforms.uTime!.value = clock.elapsedTime;
  });
  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-10} material={material}>
      <sphereGeometry args={[400, 28, 16]} />
    </mesh>
  );
}

function Ocean({ waves, vertexWaves, segments }: { waves: number; vertexWaves: number; segments: [number, number] }) {
  const material = useMemo(() => createOceanMaterial(waves, vertexWaves), [waves, vertexWaves]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 145]} material={material}>
      <planeGeometry args={[380, 270, segments[0], segments[1]]} />
    </mesh>
  );
}

function Curtains({ segments }: { segments: [number, number] }) {
  const material = useMemo(() => createCurtainMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.userData.time.value = clock.elapsedTime;
  });
  return (
    <>
      <mesh position={[2.2, 1.6, 4.3]} material={material}>
        <planeGeometry args={[0.8, 3.1, segments[0], segments[1]]} />
      </mesh>
      <mesh position={[-2.2, 1.6, 4.3]} material={material}>
        <planeGeometry args={[0.8, 3.1, segments[0], segments[1]]} />
      </mesh>
    </>
  );
}

function Rocks({ material, detail, shadows }: { material: Material; detail: number; shadows: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const rocks = useMemo(() => rockLayout(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    rocks.forEach((rock, index) => {
      dummy.position.set(rock.position[0], rock.position[1], rock.position[2]);
      dummy.scale.set(rock.scale[0], rock.scale[1], rock.scale[2]);
      dummy.rotation.set(rock.rotation[0], rock.rotation[1], rock.rotation[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [rocks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, rocks.length]} material={material} castShadow={shadows} receiveShadow={shadows}>
      <icosahedronGeometry args={[1, detail]} />
    </instancedMesh>
  );
}

function Fig({ pot, leaf, shadows, count }: { pot: Material; leaf: Material; shadows: boolean; count: number }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    for (let i = 0; i < count; i += 1) {
      const turn = (i / count) * Math.PI * 2;
      dummy.position.set(Math.sin(turn) * 0.22, 0.85 + (i % 3) * 0.28, Math.cos(turn) * 0.18);
      dummy.rotation.set(0.45 + (i % 2) * 0.35, turn, 0.25);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <group position={FIG_AT}>
      <mesh position={[0, 0.2, 0]} material={pot} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.32, 0.26, 0.4, 8]} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} material={leaf}>
        <planeGeometry args={[0.34, 0.48]} />
      </instancedMesh>
    </group>
  );
}

function SolidMesh({
  min,
  max,
  material,
  shadows,
  transparent,
}: {
  min: readonly number[];
  max: readonly number[];
  material: Material;
  shadows: boolean;
  transparent?: boolean;
}) {
  const [w, h, d, x, y, z] = boxSize(min, max);
  return (
    <mesh position={[x, y, z]} material={material} castShadow={shadows && !transparent} receiveShadow={shadows}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}


/** Late-afternoon seaside: sky dome, Gerstner water, and furnished rooms. */
export function SeasideHouseScene({ onReady, quality }: WorldSceneProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const ready = useRef(false);
  const size = textureSizeForTier(quality.tier);
  const maps = seasideMaps(size) ?? seasideMaps(1024) ?? seasideMaps(512);
  const resolvedFoliage = useResolvedFoliage(quality.tier, quality.foliage);
  const materials = useMemo(() => (maps ? buildHouseMaterials(maps, resolvedFoliage) : null), [maps, resolvedFoliage]);
  const headland = useMemo(() => new MeshStandardMaterial({ color: '#6d6458', roughness: 0.96 }), []);
  const beacon = useMemo(() => new MeshBasicMaterial({ color: '#FFC98F' }), []);
  useEffect(() => () => {
    headland.dispose();
    beacon.dispose();
  }, [headland, beacon]);
  const shadows = quality.shadows !== 'off';
  const clouds = cloudLayers(quality.tier);

  useEffect(() => {
    scene.background = new Color('#E7C7A4');
    let env: ReturnType<typeof environmentFromSky> | null = null;
    let disposed = false;
    const build = () => {
      env?.dispose();
      try {
        env = environmentFromSky(gl, 2);
        scene.environment = env.texture;
        scene.environmentIntensity = 0.34;
      } catch {
        env = null;
      }
    };
    build();
    const onRestore = () => {
      if (!disposed) build();
    };
    gl.domElement.addEventListener('webglcontextrestored', onRestore);
    let cancelled = false;
    void warmSceneShaders(gl, scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (cancelled || ready.current) return;
        ready.current = true;
        onReady();
      });
    return () => {
      disposed = true;
      cancelled = true;
      releaseWarmedMaterials();
      gl.domElement.removeEventListener('webglcontextrestored', onRestore);
      env?.dispose();
      if (env && scene.environment === env.texture) scene.environment = null;
    };
  }, [gl, scene, onReady, camera]);

  useEffect(() => () => materials?.dispose(), [materials]);
  useEffect(() => {
    if (!maps) return undefined;
    retainTextureSize(size);
    const stillHeld = cachedTextureSizes().filter((key) => key !== size);
    return trackGpuBytes(estimateTextureBytes(size, stillHeld));
  }, [maps, size]);

  if (!materials) return null;

  const architecture = levelBoxes.filter((item) => !item.id.startsWith('curtain'));
  const materialFor = (kind: ReturnType<typeof architectureKind> | FurnishMaterial) => {
    if (kind === 'glass') return materials.glass;
    if (kind === 'metal') return materials.metal;
    if (kind === 'plasterDark') return materials.plasterDark;
    if (kind === 'linen') return materials.linen;
    if (kind === 'ceramic') return materials.ceramic;
    if (kind === 'bronze') return materials.bronze;
    if (kind === 'travertine' || kind === 'travertineFloor') return materials.byKind[kind] ?? materials.byKind.travertineDetail!;
    return materials.byKind[kind] ?? materials.byKind.plaster!;
  };

  return (
    <>
      <fogExp2 attach="fog" args={['#E7C7A4', 0.011]} />
      <hemisphereLight args={['#F4E0C4', '#6A5344', 0.16]} />
      <SunLight shadows={shadows} mapSize={quality.shadowMapSize} />
      <pointLight position={[0.4, 2.35, 1.6]} intensity={7} distance={6.5} decay={2} color="#FFE0C0" />
      <pointLight position={[2.55, 1.45, -1.55]} intensity={3.5} distance={3.2} decay={2} color="#FFD2A8" />
      <SkyDome clouds={clouds} />
      <Ocean waves={waveCount(quality.tier)} vertexWaves={vertexWaveCount(quality.tier)} segments={oceanSegments(quality.tier)} />
      <mesh position={[0, -3.6, 11.4]} rotation={[-0.82, 0, 0]} material={materials.byKind.rock} receiveShadow={shadows}>
        <planeGeometry args={[18, 4.5, 1, 3]} />
      </mesh>
      <mesh position={[52, 1.2, 78]} scale={[26, 8.5, 16]} material={headland} castShadow={shadows}>
        <sphereGeometry args={[1, 20, 12]} />
      </mesh>
      <mesh position={[74, 2.4, 98]} scale={[16, 6.5, 12]} material={headland}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>
      <mesh position={[46, 8.2, 70]} material={materials.ceramic} castShadow={shadows}>
        <cylinderGeometry args={[0.28, 0.38, 2.4, 6]} />
      </mesh>
      <mesh position={[46, 9.5, 70]} material={beacon}>
        <sphereGeometry args={[0.18, 8, 6]} />
      </mesh>
      <Rocks material={materials.byKind.rock!} detail={rockDetail(quality.tier)} shadows={shadows} />
      {architecture.map((item) => (
        <SolidMesh
          key={item.id}
          min={item.box.min}
          max={item.box.max}
          material={materialFor(architectureKind(item.id))}
          shadows={shadows}
          transparent={item.opacity < 1}
        />
      ))}
      {furnitureVisuals.filter((item) => item.id !== 'fig-pot').map((item) => (
        <SolidMesh
          key={item.id}
          min={item.min}
          max={item.max}
          material={materialFor(item.material)}
          shadows={shadows}
        />
      ))}
      <Fig pot={materials.byKind.travertineDetail!} leaf={materials.leaf} shadows={shadows} count={leafCount(quality.tier)} />
      <Curtains segments={curtainSegments(quality.tier)} />
    </>
  );
}
