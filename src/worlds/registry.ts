import type { WorldDefinition } from '@/contracts/world';
import { farm } from './farm/definition';
import { nyBalcony } from './ny-balcony/definition';
import { seasideHouse } from './seaside-house/definition';

export const worlds: readonly WorldDefinition[] = [seasideHouse, nyBalcony, farm];

export function getWorld(id: string): WorldDefinition | undefined {
  return worlds.find((world) => world.id === id);
}
