'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type Material,
  type InstancedMesh,
  type Texture,
} from 'three';
import { releaseWarmedMaterials, trackGpuBytes, useResolvedFoliage, warmSceneShaders } from '@/engine';
import type { WorldSceneProps } from '@/contracts/world';
import { createCurtainMaterial } from './art/curtains';
import { environmentFromHdri, type SeasideEnvironment } from './art/hdri';
import { buildFarRidgeGeometry, buildHeadlandGeometry, headlandResolution, LIGHTHOUSE_AT } from './art/headland';
import { CAMERA_FAR, SEASIDE_BACKGROUND, SEASIDE_FOG_COLOR, SEASIDE_FOG_DENSITY, SEASIDE_SUN, SKY_DOME_RADIUS } from './art/horizon';
import { loadSeasideNature, natureTextureBytes, type NatureHandle } from './art/nature';
import { buildOceanGeometry, oceanGrid } from './art/oceanMesh';
import { cloudLayers, curtainSegments, leafCount, textureSizeForTier, waveCount } from './art/scale';
import { shadowFrustum } from './art/shadowFit';
import { createOceanMaterial, createSkyMaterial } from './art/shaders';
import { cachedTextureSizes, cloneRepeat, estimateTextureBytes, retainTextureSize, seasideMaps, type SeasideMaps } from './art/textures';
import { loadWaterNormals } from './art/water';
import { FIG_AT, furnitureVisuals, type FurnishMaterial } from './furniture';
import { levelBoxes, SEA_Y } from './level';

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
        position={[SEASIDE_SUN[0] * 40, SEASIDE_SUN[1] * 40, SEASIDE_SUN[2] * 40]}
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
    <mesh ref={mesh} frustumCulled={false} renderOrder={-1} material={material}>
      <sphereGeometry args={[SKY_DOME_RADIUS, 48, 24]} />
    </mesh>
  );
}

function Ocean({ waves, rings, segments }: { waves: number; rings: number; segments: number }) {
  const gl = useThree((state) => state.gl);
  const material = useMemo(() => createOceanMaterial(waves), [waves]);
  const geometry = useMemo(() => buildOceanGeometry(rings, segments), [rings, segments]);
  useEffect(() => () => {
    material.dispose();
    geometry.dispose();
    for (const key of ['uNormalA', 'uNormalB'] as const) {
      const texture = material.uniforms[key]?.value as Texture | undefined;
      if (texture?.userData.flat) texture.dispose();
    }
  }, [material, geometry]);
  useEffect(() => {
    let alive = true;
    let maps: { dispose: () => void } | null = null;
    const apply = () => {
      void loadWaterNormals(gl).then((loaded) => {
        if (!alive) {
          loaded.dispose();
          return;
        }
        const previousA = material.uniforms.uNormalA?.value as Texture | undefined;
        const previousB = material.uniforms.uNormalB?.value as Texture | undefined;
        if (previousA?.userData.flat) previousA.dispose();
        if (previousB?.userData.flat) previousB.dispose();
        maps?.dispose();
        maps = loaded;
        material.uniforms.uNormalA!.value = loaded.a;
        material.uniforms.uNormalB!.value = loaded.b;
      }).catch(() => undefined);
    };
    apply();
    const onRestore = () => {
      if (alive) apply();
    };
    gl.domElement.addEventListener('webglcontextrestored', onRestore);
    return () => {
      alive = false;
      gl.domElement.removeEventListener('webglcontextrestored', onRestore);
      maps?.dispose();
    };
  }, [gl, material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
  });
  return <mesh position={[0, SEA_Y, -3]} geometry={geometry} material={material} />;
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
  renderOrder = 0,
}: {
  min: readonly number[];
  max: readonly number[];
  material: Material;
  shadows: boolean;
  transparent?: boolean;
  renderOrder?: number;
}) {
  const [w, h, d, x, y, z] = boxSize(min, max);
  return (
    <mesh position={[x, y, z]} material={material} castShadow={shadows && !transparent} receiveShadow={shadows} renderOrder={renderOrder}>
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
  // Seam diagnostic: the glass is MeshStandardMaterial, not transmission, so there is no second ocean pass.
  // The line was the opaque cap plus FogExp2 on the rail (the ocean shades its own haze). Rail glass stays fog-free.
  const railGlass = useMemo(() => new MeshStandardMaterial({
    color: '#d7e6e8',
    roughness: 0.05,
    metalness: 0.04,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    envMapIntensity: 1.4,
    fog: false,
  }), []);
  const headlandMaterial = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.94, vertexColors: true }), []);
  const farRidgeMaterial = useMemo(() => new MeshStandardMaterial({ color: '#8E8F8A', roughness: 0.96 }), []);
  const lighthouseMaterial = useMemo(() => new MeshStandardMaterial({ color: '#EDE8DF', roughness: 0.72 }), []);
  const lanternMaterial = useMemo(() => new MeshStandardMaterial({ color: '#2E2A26', roughness: 0.5 }), []);
  const lipMaterial = useMemo(() => new MeshStandardMaterial({ color: '#BFB3A3', roughness: 0.9 }), []);
  const gapMaterial = useMemo(() => new MeshStandardMaterial({ color: '#6A6258', roughness: 0.95 }), []);
  const headlandGeometry = useMemo(() => {
    const detail = headlandResolution(quality.tier);
    return buildHeadlandGeometry(detail.stations, detail.steps);
  }, [quality.tier]);
  const farRidgeGeometry = useMemo(() => buildFarRidgeGeometry(64, 8), []);
  const [nature, setNature] = useState<Group | null>(null);
  useEffect(() => () => {
    railGlass.dispose();
    headlandMaterial.dispose();
    farRidgeMaterial.dispose();
    lighthouseMaterial.dispose();
    lanternMaterial.dispose();
    lipMaterial.dispose();
    gapMaterial.dispose();
    headlandGeometry.dispose();
    farRidgeGeometry.dispose();
  }, [railGlass, headlandMaterial, farRidgeMaterial, lighthouseMaterial, lanternMaterial, lipMaterial, gapMaterial, headlandGeometry, farRidgeGeometry]);
  const shadows = quality.shadows !== 'off';
  const clouds = cloudLayers(quality.tier);
  const grid = oceanGrid(quality.tier);

  useEffect(() => {
    const previousFar = camera.far;
    camera.far = CAMERA_FAR;
    camera.updateProjectionMatrix();
    scene.background = new Color(SEASIDE_BACKGROUND);
    let env: SeasideEnvironment | null = null;
    let natureHandle: NatureHandle | null = null;
    let cancelled = false;
    const buildEnv = async () => {
      const next = await environmentFromHdri(gl);
      if (cancelled) {
        next.dispose();
        return;
      }
      env?.dispose();
      env = next;
      scene.environment = next.texture;
      scene.environmentIntensity = 0.6;
      scene.environmentRotation.y = next.yaw;
    };
    const buildNature = async () => {
      const next = await loadSeasideNature(gl, quality.tier);
      if (cancelled) {
        next.dispose();
        return;
      }
      natureHandle?.dispose();
      natureHandle = next;
      setNature(next.group);
    };
    const onRestore = () => {
      if (cancelled) return;
      void buildEnv().catch(() => undefined);
      void buildNature().catch(() => undefined);
    };
    gl.domElement.addEventListener('webglcontextrestored', onRestore);
    void Promise.all([
      buildEnv().catch((error: unknown) => console.error(error)),
      buildNature().catch((error: unknown) => console.error(error)),
      warmSceneShaders(gl, scene, camera).catch((error: unknown) => console.error(error)),
    ]).then(() => {
      if (cancelled || ready.current) return;
      ready.current = true;
      onReady();
    });
    return () => {
      cancelled = true;
      camera.far = previousFar;
      camera.updateProjectionMatrix();
      gl.domElement.removeEventListener('webglcontextrestored', onRestore);
      env?.dispose();
      if (env && scene.environment === env.texture) scene.environment = null;
      natureHandle?.dispose();
      releaseWarmedMaterials();
      setNature(null);
    };
  }, [gl, scene, onReady, camera, quality.tier]);

  useEffect(() => () => materials?.dispose(), [materials]);
  useEffect(() => {
    if (!maps) return undefined;
    retainTextureSize(size);
    const stillHeld = cachedTextureSizes().filter((key) => key !== size);
    return trackGpuBytes(estimateTextureBytes(size, stillHeld) + natureTextureBytes(quality.tier));
  }, [maps, size, quality.tier]);

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
      <fogExp2 attach="fog" args={[SEASIDE_FOG_COLOR, SEASIDE_FOG_DENSITY]} />
      <SunLight shadows={shadows} mapSize={quality.shadowMapSize} />
      <pointLight position={[2.55, 1.45, -1.55]} intensity={3.5} distance={3.2} decay={2} color="#FFD2A8" />
      <SkyDome clouds={clouds} />
      <Ocean waves={waveCount(quality.tier)} rings={grid.rings} segments={grid.segments} />
      <mesh geometry={headlandGeometry} material={headlandMaterial} castShadow={false} receiveShadow={false} />
      <mesh geometry={farRidgeGeometry} material={farRidgeMaterial} castShadow={false} receiveShadow={false} />
      <mesh position={[LIGHTHOUSE_AT[0], LIGHTHOUSE_AT[1] + 8, LIGHTHOUSE_AT[2]]} material={lighthouseMaterial} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[2, 2.15, 16, 12]} />
      </mesh>
      <mesh position={[LIGHTHOUSE_AT[0], LIGHTHOUSE_AT[1] + 17.1, LIGHTHOUSE_AT[2]]} material={lanternMaterial} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[1.45, 1.55, 2.2, 10]} />
      </mesh>
      <mesh position={[0, -0.175, 9.02]} material={lipMaterial} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[14, 0.35, 0.12]} />
      </mesh>
      <mesh position={[0, -0.05, 8.9]} material={gapMaterial} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[14, 0.04, 0.18]} />
      </mesh>
      {nature ? <primitive object={nature} /> : null}
      {architecture.map((item) => {
        const rail = item.id.startsWith('rail-') && item.id !== 'rail-cap-north';
        return (
          <SolidMesh
            key={item.id}
            min={item.box.min}
            max={item.box.max}
            material={rail ? railGlass : materialFor(architectureKind(item.id))}
            shadows={shadows}
            transparent={item.opacity < 1}
            renderOrder={rail ? 2 : 0}
          />
        );
      })}
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
