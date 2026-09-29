const until = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** 600 ms accent outline. A second open of the same pinned app recalls it instead. */
export function pulseWindow(id: string): void {
  until.set(id, Date.now() + 600);
  const pending = timers.get(id);
  if (pending) clearTimeout(pending);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      if ((until.get(id) ?? 0) <= Date.now()) until.delete(id);
      notify();
    }, 600),
  );
  notify();
}

export function windowPulsing(id: string): boolean {
  return (until.get(id) ?? 0) > Date.now();
}

export function subscribePulse(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
