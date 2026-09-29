'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import { bus } from '@/engine/events/bus';
import { inputManager } from '@/engine/input/InputManager';
import { useGlStore } from '@/state/gl';

const FALLBACK_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: true,
  desynchronized: false,
  failIfMajorPerformanceCaveat: false,
  powerPreference: 'default',
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  stencil: false,
};

/** A lost context makes getContextAttributes() return null. The composer reads `.alpha` on the next pass. */
function keepContextAttributes(gl: WebGLRenderer): void {
  const context = gl.getContext() as WebGLRenderingContext & { __ghilandAttrs?: boolean };
  if (context.__ghilandAttrs) return;
  context.__ghilandAttrs = true;
  const native = context.getContextAttributes.bind(context);
  context.getContextAttributes = () => native() ?? FALLBACK_ATTRIBUTES;
}

export function ContextGuard() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const canvas = gl.domElement;
    keepContextAttributes(gl);
    const onLost = (event: Event) => {
      event.preventDefault();
      gl.setAnimationLoop(null);
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
