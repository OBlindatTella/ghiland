import type { AppDefinition } from '@/contracts/app';
import { chatApp } from './ai-chat/definition';
import { notesApp } from './notes/definition';
import { webApp } from './web/definition';

/** Alpha shelf order: Notes, Chat, then the external-fallback tile. Settings is a shell tile. */
export const apps: readonly AppDefinition[] = [notesApp, chatApp, webApp];

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((app) => app.id === id);
}
