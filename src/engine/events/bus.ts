import type { GhilandEvents } from '@/contracts/events';

type Handler<T> = (payload: T) => void;

export function createBus<Events extends object>() {
  const listeners = new Map<keyof Events, Set<Handler<Events[keyof Events]>>>();

  return {
    on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(handler as Handler<Events[keyof Events]>);
      return () => {
        set.delete(handler as Handler<Events[keyof Events]>);
      };
    },
    emit<K extends keyof Events>(type: K, payload: Events[K]): void {
      const set = listeners.get(type);
      if (!set) return;
      for (const handler of set) handler(payload as Events[keyof Events]);
    },
  };
}

export const bus = createBus<GhilandEvents>();
