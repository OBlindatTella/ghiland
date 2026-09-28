import type { AppDefinition } from '@/contracts/app';

/** Step 6 registers apps here. */
export const apps: readonly AppDefinition[] = [];

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((app) => app.id === id);
}
