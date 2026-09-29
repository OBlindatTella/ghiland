export interface WindowBridge {
  pin: (id: string) => void;
  detach: (id: string) => void;
  recall: (id: string) => void;
}

let bridge: WindowBridge | null = null;

export function installWindowBridge(next: WindowBridge | null): void {
  bridge = next;
}

export function requestPin(id: string): void {
  bridge?.pin(id);
}

export function requestDetach(id: string): void {
  bridge?.detach(id);
}

export function requestRecall(id: string): void {
  bridge?.recall(id);
}
