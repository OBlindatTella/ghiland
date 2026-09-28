'use client';

import { usePerfStore } from '@/state/perf';
import { useAppliedQuality } from '@/state/appliedQuality';
import { useSettings } from '@/state/settings';

function n(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function PerfHud() {
  const metrics = usePerfStore((state) => state.metrics);
  const applied = useAppliedQuality((state) => state.tier);
  const setting = useSettings((state) => state.quality);
  const heap = metrics.heapMb === null ? 'n/a' : `${metrics.heapMb.toFixed(0)} MB`;

  return (
    <p
      id="ghiland-perf"
      data-testid="perf-hud"
      className="pointer-events-none absolute top-3 left-3 z-30 rounded-[6px] bg-[#141413]/90 px-2 py-1 font-mono text-[11px] leading-4 text-[#f2f0eb]"
    >
      {metrics.fps.toFixed(0)} fps · {metrics.frameMs.toFixed(1)} ms
      <br />
      {n(metrics.calls)} draws · {n(metrics.triangles)} tris
      <br />
      {n(metrics.geometries)} geo · {n(metrics.textures)} tex · gpu {metrics.gpuMb.toFixed(0)} MB
      <br />
      heap {heap}
      <br />
      {metrics.longTasks} long tasks · {setting === 'AUTO' ? `AUTO ${applied}` : applied}
    </p>
  );
}
