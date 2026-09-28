'use client';

export function PerfHud() {
  return (
    <p
      id="ghiland-perf"
      className="pointer-events-none absolute top-3 left-3 z-20 rounded bg-[#141413]/85 px-2 py-1 font-mono text-[11px] text-[#f2f0eb]"
    >
      — fps
    </p>
  );
}
