'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { perfSample, usePerfStore } from '@/state/perf';
import { useGlStore } from '@/state/gl';
import { trackedGpuMb } from '@/engine/quality/gpuMemory';

interface HeapMemory {
  usedJSHeapSize: number;
}

export function PerfProbe() {
  const gl = useThree((state) => state.gl);
  const bucket = useRef({ frames: 0, time: 0, callSum: 0, triSum: 0, longTasks: 0 });

  useEffect(() => {
    gl.info.autoReset = false;
    const supported = typeof PerformanceObserver !== 'undefined';
    if (!supported) return;
    const observer = new PerformanceObserver((list) => {
      bucket.current.longTasks += list.getEntries().length;
    });
    try {
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      observer.disconnect();
    }
    return () => observer.disconnect();
  }, [gl]);

  useFrame((_, dt) => {
    if (useGlStore.getState().lost) return;
    const calls = gl.info.render.calls;
    const triangles = gl.info.render.triangles;
    gl.info.reset();
    const sample = bucket.current;
    sample.frames += 1;
    sample.time += dt;
    sample.callSum += calls;
    sample.triSum += triangles;
    if (sample.time < 0.5) return;
    const memory = (performance as Performance & { memory?: HeapMemory }).memory;
    const metrics = {
      fps: sample.frames / sample.time,
      frameMs: (sample.time / sample.frames) * 1000,
      calls: Math.round(sample.callSum / sample.frames),
      triangles: Math.round(sample.triSum / sample.frames),
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      heapMb: memory ? memory.usedJSHeapSize / (1024 * 1024) : null,
      gpuMb: trackedGpuMb(),
      longTasks: sample.longTasks,
    };
    Object.assign(perfSample, metrics);
    usePerfStore.getState().setMetrics(metrics);
    sample.frames = 0;
    sample.time = 0;
    sample.callSum = 0;
    sample.triSum = 0;
    sample.longTasks = 0;
  }, 2);

  return null;
}
