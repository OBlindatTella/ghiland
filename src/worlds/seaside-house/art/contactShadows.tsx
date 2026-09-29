'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { CanvasTexture, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';

export interface ContactFootprint {
  x: number;
  z: number;
  w: number;
  d: number;
}

function radialBlob(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  const ink = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  ink.addColorStop(0, 'rgba(255,255,255,1)');
  ink.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  ink.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** One draw: a soft blob under every furniture footprint, a little larger than the box. */
export function ContactDecals({ footprints }: { footprints: readonly ContactFootprint[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const texture = useMemo(() => radialBlob(), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture,
        color: '#1A140F',
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [texture],
  );
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  useLayoutEffect(() => {
    const current = mesh.current;
    if (!current) return;
    const dummy = new Object3D();
    footprints.forEach((piece, index) => {
      dummy.position.set(piece.x, 0.003, piece.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(piece.w, piece.d, 1);
      dummy.updateMatrix();
      current.setMatrixAt(index, dummy.matrix);
    });
    current.count = footprints.length;
    current.instanceMatrix.needsUpdate = true;
  }, [footprints]);
  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
      geometry.dispose();
    },
    [texture, material, geometry],
  );
  return (
    <instancedMesh ref={mesh} args={[geometry, material, footprints.length]} frustumCulled={false} renderOrder={1} />
  );
}
