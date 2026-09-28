'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/** Writes fps, draw calls, and triangles into the dev readout. Samples stay off the React tree. */
export function PerfProbe() {
  const gl = useThree((state) => state.gl);
  const sample = useRef({ frames: 0, time: 0, calls: 0, triangles: 0 });

  useFrame((_, dt) => {
    const bucket = sample.current;
    bucket.frames += 1;
    bucket.time += dt;
    bucket.calls = gl.info.render.calls;
    bucket.triangles = gl.info.render.triangles;
    if (bucket.time < 0.25) return;
    const fps = bucket.frames / bucket.time;
    const readout = document.getElementById('ghiland-perf');
    if (readout) {
      const shell = document.body.dataset.shell ?? '';
      readout.textContent = `${fps.toFixed(0)} fps · ${bucket.calls} draws · ${bucket.triangles} tris${shell ? ` · ${shell}` : ''}`;
    }
    bucket.frames = 0;
    bucket.time = 0;
  });

  return null;
}
