import type { WorldDefinition } from '@/contracts/world';

/** Step 2 registers worlds here. The greybox mounts Seaside directly. */
export const worlds: readonly WorldDefinition[] = [];

export function getWorld(id: string): WorldDefinition | undefined {
  return worlds.find((world) => world.id === id);
}
