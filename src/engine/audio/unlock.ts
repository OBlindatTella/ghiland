let context: AudioContext | null = null;

/** Created on the Seaside card click so the browser unlocks audio. Step 4 builds the graph on this context. */
export function unlockAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  if (context.state !== 'running') void context.resume();
  return context;
}

export function getAudioContext(): AudioContext | null {
  return context;
}
