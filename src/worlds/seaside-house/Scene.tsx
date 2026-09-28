'use client';

import { useEffect } from 'react';
import type { WorldSceneProps } from '@/contracts/world';
import { levelBoxes, SEA_Y } from './level';

function sunPosition(elevationDeg: number, azimuthDeg: number, distance: number): [number, number, number] {
  const elevation = (elevationDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const horizontal = Math.cos(elevation) * distance;
  return [Math.sin(azimuth) * horizontal, Math.sin(elevation) * distance, Math.cos(azimuth) * horizontal];
}

function AabbMesh({
  item,
}: {
  item: (typeof levelBoxes)[number];
}) {
  const width = item.box.max[0] - item.box.min[0];
  const height = item.box.max[1] - item.box.min[1];
  const depth = item.box.max[2] - item.box.min[2];
  const transparent = item.opacity < 1;
  return (
    <mesh
      position={[
        (item.box.min[0] + item.box.max[0]) / 2,
        (item.box.min[1] + item.box.max[1]) / 2,
        (item.box.min[2] + item.box.max[2]) / 2,
      ]}
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={item.color}
        roughness={transparent ? 0.15 : 0.92}
        metalness={0}
        transparent={transparent}
        opacity={item.opacity}
        depthWrite={!transparent}
      />
    </mesh>
  );
}

/** Greybox only: boxes, a flat sea, sun, hemisphere, and fog. */
export function SeasideHouseScene({ onReady, quality }: WorldSceneProps) {
  useEffect(() => {
    onReady();
  }, [onReady, quality]);

  const sun = sunPosition(12, 22, 40);
  const opaque = levelBoxes.filter((item) => item.opacity >= 1);
  const transparent = levelBoxes.filter((item) => item.opacity < 1);

  return (
    <>
      <color attach="background" args={['#E7C7A4']} />
      <fogExp2 attach="fog" args={['#E7C7A4', 0.011]} />
      <hemisphereLight args={['#F4E0C4', '#7A6552', 0.55]} />
      <directionalLight position={sun} intensity={2.6} color="#FFC98F" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 80]}>
        <planeGeometry args={[520, 460]} />
        <meshStandardMaterial color="#1E6A72" roughness={0.42} metalness={0.04} />
      </mesh>
      {opaque.map((item) => (
        <AabbMesh key={item.id} item={item} />
      ))}
      {transparent.map((item) => (
        <AabbMesh key={item.id} item={item} />
      ))}
    </>
  );
}
