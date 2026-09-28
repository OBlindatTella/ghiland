import type { WorldPhase } from '@/contracts/world';

/** SceneManager owns this sequence in build step 2. */
export const worldPhases: readonly WorldPhase[] = [
  'idle',
  'loading',
  'ready',
  'entering',
  'active',
  'exiting',
];
