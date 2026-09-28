'use client';

import { useEffect, useState } from 'react';
import { audioEngine } from '@/engine/audio/engine';
import type { QualitySetting } from '@/contracts/quality';
import { usePerfStore } from '@/state/perf';
import { useScreenStore } from '@/state/screen';
import { useSettings } from '@/state/settings';

const QUALITY: { id: QualitySetting; label: string }[] = [
  { id: 'LOW', label: 'Low' },
  { id: 'MED', label: 'Med' },
  { id: 'HIGH', label: 'High' },
  { id: 'ULTRA', label: 'Ultra' },
  { id: 'AUTO', label: 'Auto' },
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label className="mt-3 block text-[13px] leading-5">
      <span className="flex justify-between text-[#f2f0eb]">
        {label}
        <span className="text-[#f2f0eb]/64">{dragging ? display(value) : ''}</span>
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-[#86bdb2]"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onBlur={() => setDragging(false)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SettingsPanel() {
  const open = useScreenStore((state) => state.stack.includes('settings'));
  const settings = useSettings();
  const autoTier = usePerfStore((state) => state.autoTier);
  useEffect(() => {
    if (open) audioEngine.playTick();
  }, [open]);

  if (!open) return null;

  const close = () => useScreenStore.getState().remove('settings');

  return (
    <section
      role="region"
      aria-label="Settings"
      data-testid="settings-panel"
      className="absolute top-1/2 left-1/2 z-30 flex h-[min(560px,calc(100%-96px))] w-[min(480px,calc(100%-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#141413]/90 text-[#f2f0eb] shadow-[0_8px_24px_rgba(0,0,0,0.32)]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="flex h-8 items-center justify-between px-4">
        <h1 className="text-[12px] leading-4 font-semibold text-[#f2f0eb]/64">Settings</h1>
        <button type="button" className="text-[13px] leading-5 text-[#f2f0eb]/64" onClick={close} aria-label="Close settings">
          ×
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <h2 className="text-[12px] leading-4 text-[#f2f0eb]/64">Sound</h2>
        <Slider label="Master" min={0} max={1} step={0.01} value={settings.master} display={(value) => String(Math.round(value * 100))} onChange={settings.setMaster} />
        <Slider label="Ambient" min={0} max={1} step={0.01} value={settings.ambient} display={(value) => String(Math.round(value * 100))} onChange={settings.setAmbient} />
        <Slider label="Interface" min={0} max={1} step={0.01} value={settings.interface} display={(value) => String(Math.round(value * 100))} onChange={settings.setInterface} />
        <label className="mt-3 flex items-center justify-between text-[13px] leading-5">
          Mute
          <input type="checkbox" checked={settings.muted} onChange={(event) => settings.setMuted(event.target.checked)} />
        </label>
        <h2 className="mt-6 text-[12px] leading-4 text-[#f2f0eb]/64">Controls</h2>
        <Slider
          label="Mouse sensitivity"
          min={0.1}
          max={3}
          step={0.1}
          value={settings.mouseSensitivity}
          display={(value) => value.toFixed(1)}
          onChange={settings.setSensitivity}
        />
        <Slider label="Field of view" min={55} max={75} step={1} value={settings.fovDeg} display={(value) => `${Math.round(value)}°`} onChange={settings.setFov} />
        <label className="mt-3 flex items-center justify-between text-[13px] leading-5">
          Invert Y
          <input type="checkbox" checked={settings.invertY} onChange={(event) => settings.setInvertY(event.target.checked)} />
        </label>
        <h2 className="mt-6 text-[12px] leading-4 text-[#f2f0eb]/64">Graphics</h2>
        <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Quality">
          {QUALITY.map((item) => {
            const selected = settings.quality === item.id;
            const suffix = item.id === 'AUTO' && selected ? ` · ${autoTier[0]}${autoTier.slice(1).toLowerCase()}` : '';
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className="rounded-[6px] border border-white/10 px-2 py-1 text-[12px] leading-4"
                style={{ background: selected ? '#86bdb2' : 'transparent', color: selected ? '#141413' : '#f2f0eb' }}
                onClick={() => settings.setQuality(item.id)}
              >
                {item.label}
                {suffix}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
