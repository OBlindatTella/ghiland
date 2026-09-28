'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const STABLE_DT = 0.02;
const STABLE_COUNT = 3;
/** Software GL on a build machine may never hold 20 ms frames. Don't trap the arrival. */
const FALLBACK_SEC = 2.5;

export function StableFrames({ onStable }: { onStable: () => void }) {
  const run = useRef(0);
  const elapsed = useRef(0);
  const done = useRef(false);

  useFrame((_, dt) => {
    if (done.current) return;
    elapsed.current += dt;
    run.current = dt < STABLE_DT ? run.current + 1 : 0;
    if (run.current >= STABLE_COUNT || elapsed.current >= FALLBACK_SEC) {
      done.current = true;
      onStable();
    }
  });

  return null;
}
