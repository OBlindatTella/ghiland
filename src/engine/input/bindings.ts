import type { KeyBinding } from '@/contracts/input';

/** Physical codes. Tab is intentionally absent so it stays focus navigation. */
export const defaultBindings: readonly KeyBinding[] = [
  { action: 'moveForward', codes: ['KeyW', 'ArrowUp'], owners: ['world'] },
  { action: 'moveBack', codes: ['KeyS', 'ArrowDown'], owners: ['world'] },
  { action: 'moveLeft', codes: ['KeyA', 'ArrowLeft'], owners: ['world'] },
  { action: 'moveRight', codes: ['KeyD', 'ArrowRight'], owners: ['world'] },
  { action: 'strollFast', codes: ['ShiftLeft', 'ShiftRight'], owners: ['world'] },
  { action: 'toggleScreen', codes: ['KeyQ'], owners: ['world', 'ui'] },
  { action: 'interact', codes: ['KeyE'], owners: ['world', 'ui'] },
  { action: 'pin', codes: ['KeyP'], owners: ['world', 'ui'] },
  { action: 'toggleMute', codes: ['KeyM'], owners: ['world'] },
  { action: 'togglePerfHud', codes: ['Backquote'], owners: ['world', 'ui', 'system'] },
  { action: 'escape', codes: ['Escape'], owners: ['ui', 'text', 'system'] },
];
