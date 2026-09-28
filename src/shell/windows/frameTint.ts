/** Mix a world accent into the frame only. Content stays on the unlit surface. Amount is 12% (D-008 allows 10–15%). */
export function mixFrameTint(accent: string, amount = 0.12): string {
  const hex = accent.replace('#', '');
  if (hex.length !== 6) return '#141413';
  const channel = (index: number) => Number.parseInt(hex.slice(index, index + 2), 16);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount);
  const r = mix(0x14, channel(0));
  const g = mix(0x14, channel(2));
  const b = mix(0x13, channel(4));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

let accent = '#FFC98F';
const listeners = new Set<() => void>();

/** Step 8 can push the live sun color here. Overlay frames read it; content does not. */
export function setFrameAccent(next: string): void {
  accent = next;
  for (const listener of listeners) listener();
}

export function frameTint(): string {
  return mixFrameTint(accent);
}

export function subscribeFrameTint(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
