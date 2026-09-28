/** Samples filled before yielding, so a bed never occupies a click handler. */
export const NOISE_CHUNK = 8192;

/**
 * Fills stereo coloured noise one chunk at a time.
 * `pause` runs after every chunk. Returns false if `cancelled` becomes true.
 */
export async function fillColouredNoise(
  channels: Float32Array[],
  sampleRate: number,
  colour: number,
  rateHz: number,
  cancelled: () => boolean,
  pause: () => Promise<void> = () => new Promise((resolve) => {
    setTimeout(resolve, 0);
  }),
): Promise<boolean> {
  const length = channels[0]?.length ?? 0;
  const held = channels.map(() => 0);
  for (let channel = 0; channel < channels.length; channel += 1) {
    const data = channels[channel];
    if (!data) continue;
    for (let start = 0; start < length; start += NOISE_CHUNK) {
      if (cancelled()) return false;
      const end = Math.min(length, start + NOISE_CHUNK);
      let value = held[channel] ?? 0;
      for (let i = start; i < end; i += 1) {
        const white = Math.random() * 2 - 1;
        value = value * colour + white * (1 - colour);
        const swell = 0.72 + 0.28 * Math.sin((Math.PI * 2 * i) / (sampleRate * rateHz) + channel * 0.6);
        data[i] = value * swell;
      }
      held[channel] = value;
      await pause();
    }
  }
  return !cancelled();
}
