import type { SpatialEmitter, WorldAudioSpec } from '@/contracts/audio';
import type { AcousticPortal, WorldZone } from '@/contracts/environment';
import { fillColouredNoise } from '@/engine/audio/noise';
import { bus } from '@/engine/events/bus';
import { distanceToOpenPortal, occlusionCutoff, zoneAt } from '@/engine/audio/occlusion';
import { useAppliedQuality } from '@/state/appliedQuality';
import { useEnvironment } from '@/state/environment';
import { useInputStore } from '@/state/input';
import { useSettings } from '@/state/settings';

export interface AudioSourceInfo {
  id: string;
  kind: 'media' | 'buffer';
  decodedBytes: number;
}

export interface AudioDebug {
  running: boolean;
  muted: boolean;
  zone: string;
  exterior: boolean;
  lowpassHz: number;
  master: number;
  ambient: number;
  interface: number;
  rms: number;
  sources: AudioSourceInfo[];
  decodedBytes: number;
}

interface BedVoice {
  id: string;
  filter: BiquadFilterNode;
  gain: GainNode;
  base: number;
  kind: 'media' | 'buffer';
  decodedBytes: number;
  stop: () => void;
}

const DB3 = 10 ** (-3 / 20);
const DB6 = 10 ** (-6 / 20);

function squared(value: number): number {
  return value * value;
}

function defer(task: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => task());
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 0);
  return () => window.clearTimeout(id);
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private interface: GainNode | null = null;
  private duck: GainNode | null = null;
  private mute: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private beds: BedVoice[] = [];
  private gullBuffer: AudioBuffer | null = null;
  private gullTimer = 0;
  private spec: WorldAudioSpec | null = null;
  private zones: readonly WorldZone[] = [];
  private portals: readonly AcousticPortal[] = [];
  private exterior = true;
  private lowpassHz = 18000;
  private zone = '';
  private started = false;
  private emitter: SpatialEmitter | null = null;
  private decodedBytes = 0;
  private gullGeneration = 0;
  private echoTimer = 0;
  private lastMuted = false;
  private unsubs: Array<() => void> = [];

  attach(ctx: AudioContext): void {
    if (this.ctx) return;
    this.ctx = ctx;
    const master = ctx.createGain();
    const ambient = ctx.createGain();
    const ui = ctx.createGain();
    const duck = ctx.createGain();
    const mute = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 2.5;
    limiter.attack.value = 0.01;
    limiter.release.value = 0.25;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ambient.connect(duck);
    duck.connect(master);
    ui.connect(master);
    master.connect(mute);
    mute.connect(limiter);
    limiter.connect(ctx.destination);
    limiter.connect(analyser);
    this.master = master;
    this.ambient = ambient;
    this.interface = ui;
    this.duck = duck;
    this.mute = mute;
    this.analyser = analyser;
    this.applyMix(0.02);
    this.unsubs.push(
      useSettings.subscribe(() => this.applyMix(0.05)),
      useInputStore.subscribe(() => this.applyDuck(0.4)),
    );
    window.addEventListener('blur', this.onFocus);
    document.addEventListener('visibilitychange', this.onFocus);
    this.unsubs.push(() => {
      window.removeEventListener('blur', this.onFocus);
      document.removeEventListener('visibilitychange', this.onFocus);
    });
  }

  start(spec: WorldAudioSpec, zones: readonly WorldZone[], portals: readonly AcousticPortal[]): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambient || this.started) return;
    this.started = true;
    this.spec = spec;
    this.zones = zones;
    this.portals = portals;
    for (const bed of spec.beds) {
      const voice = this.makeBed(ctx, bed.id, bed.gain, bed.fadeInMs ?? 1200, bed.src);
      if (voice) this.beds.push(voice);
    }
    this.emitter = spec.emitters?.find((emitter) => emitter.src) ?? null;
    if (this.emitter?.src) {
      void this.loadGull(this.emitter.src);
      this.scheduleGull(8);
    }
  }

  /** Stops every bed, emitter, and timer so a world exit or re-entry cannot stack. */
  stop(): void {
    this.gullGeneration += 1;
    for (const bed of this.beds) bed.stop();
    this.beds = [];
    globalThis.clearTimeout(this.gullTimer);
    globalThis.clearTimeout(this.echoTimer);
    this.gullTimer = 0;
    this.echoTimer = 0;
    this.gullBuffer = null;
    this.decodedBytes = 0;
    this.emitter = null;
    this.started = false;
    this.spec = null;
  }

  setListener(position: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const listener = ctx.listener;
    if (!listener.positionX) return;
    const now = ctx.currentTime;
    listener.positionX.setTargetAtTime(position.x, now, 0.03);
    listener.positionY.setTargetAtTime(position.y, now, 0.03);
    listener.positionZ.setTargetAtTime(position.z, now, 0.03);
    listener.forwardX.setTargetAtTime(forward.x, now, 0.03);
    listener.forwardY.setTargetAtTime(forward.y, now, 0.03);
    listener.forwardZ.setTargetAtTime(forward.z, now, 0.03);
  }

  setPlayer(x: number, y: number, z: number): void {
    const zone = zoneAt(x, y, z, this.zones);
    this.zone = zone?.id ?? '';
    this.exterior = zone?.kind === 'exterior';
    const distance = distanceToOpenPortal(x, z, this.portals);
    const occlusion = this.spec?.occlusion;
    this.lowpassHz = occlusion
      ? occlusionCutoff(distance, occlusion.lowpassNearHz, occlusion.lowpassFarHz, occlusion.farDistance, this.exterior)
      : 18000;
    const now = this.ctx?.currentTime ?? 0;
    for (const bed of this.beds) {
      const indoor = occlusion?.interiorBedGain?.[bed.id];
      const level = this.exterior || indoor === undefined ? 1 : indoor;
      bed.gain.gain.setTargetAtTime(bed.base * level, now, 0.15);
      if (occlusion?.exteriorSources.includes(bed.id)) {
        bed.filter.frequency.setTargetAtTime(this.lowpassHz, now, 0.2);
      }
    }
    useEnvironment.getState().setAudioZone(this.zone, this.exterior);
  }

  /** Short interface one-shots. They hit the interface bus, so the Interface slider and mute apply. */
  playUi(kind: 'open' | 'close' | 'minimize' | 'focus'): void {
    const ctx = this.ctx;
    const busNode = this.interface;
    if (!ctx || !busNode) return;
    const tone = {
      open: { freq: 880, peak: 0.04, hold: 0.07 },
      close: { freq: 494, peak: 0.035, hold: 0.06 },
      minimize: { freq: 660, peak: 0.03, hold: 0.05 },
      focus: { freq: 988, peak: 0.018, hold: 0.035 },
    }[kind];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = tone.freq;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.hold);
    osc.connect(gain);
    gain.connect(busNode);
    osc.start(now);
    osc.stop(now + tone.hold + 0.02);
  }

  playTick(): void {
    this.playUi('open');
  }

  debug(): AudioDebug {
    const data = new Uint8Array(this.analyser?.fftSize ?? 0);
    this.analyser?.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const sample = (value - 128) / 128;
      sum += sample * sample;
    }
    const settings = useSettings.getState();
    return {
      running: this.ctx?.state === 'running',
      muted: settings.muted,
      zone: this.zone,
      exterior: this.exterior,
      lowpassHz: this.lowpassHz,
      master: this.master?.gain.value ?? 0,
      ambient: this.ambient?.gain.value ?? 0,
      interface: this.interface?.gain.value ?? 0,
      rms: data.length ? Math.sqrt(sum / data.length) : 0,
      sources: [
        ...this.beds.map((bed) => ({ id: bed.id, kind: bed.kind, decodedBytes: bed.decodedBytes })),
        ...(this.gullBuffer && this.emitter
          ? [{ id: this.emitter.id, kind: 'buffer' as const, decodedBytes: this.gullBuffer.length * this.gullBuffer.numberOfChannels * 4 }]
          : []),
      ],
      decodedBytes: this.decodedBytes,
    };
  }

  private makeBed(ctx: AudioContext, id: string, gainValue: number, fadeMs: number, src: string): BedVoice | null {
    if (!this.ambient) return null;
    const character = ctx.createBiquadFilter();
    const occlusion = ctx.createBiquadFilter();
    occlusion.type = 'lowpass';
    occlusion.frequency.value = 18000;
    occlusion.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    character.connect(occlusion);
    occlusion.connect(gain);
    gain.connect(this.ambient);
    const now = ctx.currentTime;
    gain.gain.setTargetAtTime(gainValue, now, Math.max(0.05, fadeMs / 3000));
    let cancelNoise = () => {};
    let cancelPlayback = () => {};
    let dead = false;
    const voice: BedVoice = {
      id,
      filter: occlusion,
      gain,
      base: gainValue,
      kind: src ? 'media' : 'buffer',
      decodedBytes: 0,
      stop: () => {
        dead = true;
        cancelNoise();
        cancelPlayback();
      },
    };
    const procedural = () => {
      if (dead) return;
      voice.kind = 'buffer';
      const wind = id === 'wind';
      if (wind) {
        character.type = 'bandpass';
        character.frequency.value = 640;
        character.Q.value = 0.35;
      } else {
        character.type = 'lowpass';
        character.frequency.value = 2400;
        character.Q.value = 0.5;
      }
      const colour = wind ? 0.92 : 0.985;
      const rateHz = wind ? 13 : 8.5;
      cancelNoise = defer(() => {
        if (dead) return;
        const length = Math.floor(ctx.sampleRate * 12);
        const left = new Float32Array(length);
        const right = new Float32Array(length);
        void fillColouredNoise([left, right], ctx.sampleRate, colour, rateHz, () => dead).then((ok) => {
          if (!ok || dead) return;
          const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
          buffer.copyToChannel(left, 0);
          buffer.copyToChannel(right, 1);
          const bytes = buffer.length * buffer.numberOfChannels * 4;
          voice.decodedBytes += bytes;
          this.decodedBytes += bytes;
          cancelPlayback = this.startBuffer(ctx, buffer, character);
        });
      });
    };
    if (src) {
      character.type = 'lowpass';
      character.frequency.value = 18000;
      cancelPlayback = this.startMedia(ctx, src, character, procedural);
    } else {
      procedural();
    }
    return voice;
  }

  private startBuffer(ctx: AudioContext, buffer: AudioBuffer, destination: AudioNode): () => void {
    let alive = true;
    let timer = 0;
    const sources: AudioBufferSourceNode[] = [];
    const loop = (when: number, offset: number) => {
      if (!alive) return;
      const source = ctx.createBufferSource();
      const fade = ctx.createGain();
      source.buffer = buffer;
      source.connect(fade);
      fade.connect(destination);
      sources.push(source);
      const playDur = Math.max(0.2, buffer.duration - offset);
      const fadeIn = Math.min(2.5, playDur * 0.35);
      const fadeOut = Math.min(3, playDur * 0.4);
      const fadeOutStart = when + Math.max(fadeIn + 0.05, playDur - fadeOut);
      const end = when + playDur;
      fade.gain.setValueAtTime(0.0001, when);
      fade.gain.linearRampToValueAtTime(1, when + fadeIn);
      fade.gain.setValueAtTime(1, fadeOutStart);
      fade.gain.linearRampToValueAtTime(0.0001, end);
      source.start(when, offset);
      source.stop(end + 0.05);
      const overlap = Math.min(3, playDur * 0.35);
      timer = window.setTimeout(() => loop(ctx.currentTime + 0.02, 0), Math.max(50, (playDur - overlap) * 1000));
    };
    loop(ctx.currentTime, Math.random() * buffer.duration * 0.7);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      }
    };
  }

  private startMedia(ctx: AudioContext, src: string, destination: AudioNode, fallback: () => void): () => void {
    let started = false;
    let failed = false;
    const elements: HTMLAudioElement[] = [];
    const intervals = new Set<number>();
    const timeouts = new Set<number>();
    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timeouts.delete(id);
        fn();
      }, ms);
      timeouts.add(id);
    };
    const cancel = () => {
      failed = true;
      for (const id of intervals) window.clearInterval(id);
      for (const id of timeouts) window.clearTimeout(id);
      intervals.clear();
      timeouts.clear();
      for (const audio of elements) audio.pause();
    };
    const giveUp = () => {
      if (started || failed) return;
      failed = true;
      fallback();
    };
    const spawn = (lead: boolean) => {
      if (failed) return;
      const audio = new Audio(src);
      elements.push(audio);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      const source = ctx.createMediaElementSource(audio);
      const fade = ctx.createGain();
      source.connect(fade);
      fade.connect(destination);
      fade.gain.value = 0.0001;
      let handed = false;
      const handoff = () => {
        if (handed || failed) return;
        handed = true;
        fade.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
        spawn(false);
        later(2500, () => {
          audio.pause();
          source.disconnect();
          fade.disconnect();
        });
      };
      const watch = window.setInterval(() => {
        if (failed || !started) return;
        if (!Number.isFinite(audio.duration) || audio.duration === 0 || audio.paused) return;
        if (audio.currentTime < audio.duration - 3) return;
        window.clearInterval(watch);
        intervals.delete(watch);
        handoff();
      }, 200);
      intervals.add(watch);
      const abandon = () => {
        window.clearInterval(watch);
        intervals.delete(watch);
        audio.pause();
        giveUp();
      };
      audio.addEventListener('error', abandon, { once: true });
      void audio.play().then(() => {
        if (failed) {
          window.clearInterval(watch);
          intervals.delete(watch);
          audio.pause();
          return;
        }
        started = true;
        if (lead && Number.isFinite(audio.duration) && audio.duration > 4) {
          audio.currentTime = Math.random() * (audio.duration - 4);
        }
        fade.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
      }).catch(abandon);
      audio.addEventListener(
        'ended',
        () => {
          window.clearInterval(watch);
          intervals.delete(watch);
          handoff();
        },
        { once: true },
      );
    };
    spawn(true);
    return cancel;
  }

  private async loadGull(src: string): Promise<void> {
    const ctx = this.ctx;
    const generation = this.gullGeneration;
    if (!ctx) return;
    try {
      const response = await fetch(src);
      if (!response.ok) return;
      const bytes = await response.arrayBuffer();
      if (generation !== this.gullGeneration) return;
      const buffer = await ctx.decodeAudioData(bytes.slice(0));
      if (generation !== this.gullGeneration) return;
      this.gullBuffer = buffer;
      this.decodedBytes += buffer.length * buffer.numberOfChannels * 4;
    } catch {
      /* a missing gull stays silent; the beds keep playing */
    }
  }

  private scheduleGull(delaySec: number): void {
    window.clearTimeout(this.gullTimer);
    this.gullTimer = window.setTimeout(() => {
      if (!this.started || !this.emitter) return;
      this.playGull();
      if (Math.random() < 0.3) {
        window.clearTimeout(this.echoTimer);
        this.echoTimer = window.setTimeout(() => this.playGull(), 1400 + Math.random() * 1200);
      }
      this.scheduleGull(25 + Math.random() * 65);
    }, delaySec * 1000);
  }

  private playGull(): void {
    const ctx = this.ctx;
    const buffer = this.gullBuffer;
    const busNode = this.ambient;
    const emitter = this.emitter;
    if (!ctx || !buffer || !busNode || !emitter) return;
    const tier = useAppliedQuality.getState().tier;
    const panner = ctx.createPanner();
    panner.panningModel = tier === 'HIGH' || tier === 'ULTRA' ? 'HRTF' : 'equalpower';
    panner.distanceModel = emitter.rolloff === 'linear' ? 'linear' : emitter.rolloff === 'exponential' ? 'exponential' : 'inverse';
    panner.refDistance = emitter.refDistance;
    panner.maxDistance = emitter.maxDistance;
    panner.rolloffFactor = 1;
    const [x, y, z] = emitter.position;
    const jitter = (Math.random() - 0.5) * 4;
    panner.positionX.value = x + jitter;
    panner.positionY.value = y;
    panner.positionZ.value = z + jitter;
    const distance = Math.hypot(x, y, z);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.exterior ? 8000 - distance * 30 : Math.min(this.lowpassHz, 4000);
    const gain = ctx.createGain();
    gain.gain.value = emitter.gain;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.94 + Math.random() * 0.12;
    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(busNode);
    const offset = Math.random() * Math.max(0, buffer.duration - 2.5);
    source.start(ctx.currentTime, offset, Math.min(2.8, buffer.duration - offset));
  }

  private applyMix(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.ambient || !this.interface || !this.mute) return;
    const settings = useSettings.getState();
    const now = ctx.currentTime;
    this.master.gain.setTargetAtTime(squared(settings.master), now, seconds);
    this.ambient.gain.setTargetAtTime(squared(settings.ambient), now, seconds);
    this.interface.gain.setTargetAtTime(squared(settings.interface), now, seconds);
    this.mute.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.03);
    if (settings.muted !== this.lastMuted) {
      this.lastMuted = settings.muted;
      bus.emit('audio:muteChanged', { muted: settings.muted });
    }
    this.applyDuck(seconds);
  }

  private applyDuck(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.duck) return;
    let level = 1;
    if (document.hidden || !document.hasFocus()) level = DB6;
    else if (useInputStore.getState().shellState === 'RELEASED') level = DB3;
    if (useSettings.getState().muteWhenHidden && document.hidden) level = 0;
    this.duck.gain.setTargetAtTime(level, ctx.currentTime, Math.max(0.05, seconds));
  }

  private onFocus = (): void => {
    this.applyDuck(0.4);
  };
}

export const audioEngine = new AudioEngine();
