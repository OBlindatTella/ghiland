import { audioEngine } from '@/engine/audio/engine';
import { getAudioContext } from '@/engine/audio/unlock';
import { getWorld } from '@/worlds/registry';

export { audioEngine } from '@/engine/audio/engine';
export type { AudioDebug } from '@/engine/audio/engine';

export function beginWorldAudio(worldId: string): void {
  const ctx = getAudioContext();
  const world = getWorld(worldId);
  if (!ctx || !world?.audio) return;
  audioEngine.attach(ctx);
  audioEngine.start(world.audio, world.zones, world.portals ?? []);
}
