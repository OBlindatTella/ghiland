'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { bus } from '@/engine/events/bus';
import { inputManager } from '@/engine/input/InputManager';
import { useGlStore } from '@/state/gl';

export function ContextGuard() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      useGlStore.getState().lose();
      inputManager.loseContext();
      bus.emit('gl:contextLost', {});
    };
    const onRestored = () => {
      useGlStore.getState().restore();
      inputManager.releaseSystem();
      gl.compile(scene, camera);
      gl.info.reset();
      bus.emit('gl:contextRestored', {});
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, scene, camera]);

  return null;
}
