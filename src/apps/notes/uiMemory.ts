export interface NotesUiMemory {
  selectedId: string | null;
  preview: boolean;
  scrollTop: number;
  selectionStart: number;
  selectionEnd: number;
}

const memory = new Map<string, NotesUiMemory>();

export function readNotesUi(windowId: string): NotesUiMemory | null {
  const saved = memory.get(windowId);
  return saved ? { ...saved } : null;
}

export function writeNotesUi(windowId: string, value: NotesUiMemory): void {
  memory.set(windowId, { ...value });
}

export function preferredNoteId(ids: readonly string[], saved: string | null): string | null {
  if (saved && ids.includes(saved)) return saved;
  return ids[0] ?? null;
}
