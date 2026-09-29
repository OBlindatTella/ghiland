const elements = new Map<string, HTMLElement>();
let stage: HTMLElement | null = null;
let ghost: HTMLElement | null = null;
const stageListeners = new Set<() => void>();

export function bindWindowElement(id: string, element: HTMLElement | null): void {
  if (element) elements.set(id, element);
  else elements.delete(id);
}

export function windowElement(id: string): HTMLElement | undefined {
  return elements.get(id);
}

export function bindStage(element: HTMLElement | null): void {
  stage = element;
  for (const listener of stageListeners) listener();
}

export function stageElement(): HTMLElement | null {
  return stage;
}

export function subscribeStage(listener: () => void): () => void {
  stageListeners.add(listener);
  return () => stageListeners.delete(listener);
}

export function bindGhost(element: HTMLElement | null): void {
  ghost = element;
}

export function ghostElement(): HTMLElement | null {
  return ghost;
}
