'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { bindCrosshairCamera, notifyCrosshairClick } from '@/engine/windows/crosshair';

/** Lives in the canvas chunk so the landing page does not import three. */
export function CrosshairRig() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    bindCrosshairCamera(camera);
    return () => bindCrosshairCamera(null);
  }, [camera]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      notifyCrosshairClick({ x: event.clientX, y: event.clientY });
    };
    gl.domElement.addEventListener('click', onClick);
    return () => gl.domElement.removeEventListener('click', onClick);
  }, [gl]);

  return null;
}
