import type { ShellState } from '@/contracts/input';
import type { QualityTier } from '@/contracts/quality';
import type { WindowModeKind } from '@/contracts/window';

export interface GhilandEvents {
  'world:loaded': { worldId: string };
  'world:entered': { worldId: string };
  'world:exited': { worldId: string };
  'window:opened': { windowId: string; appId: string };
  'window:closed': { windowId: string; appId: string };
  'window:modeChanged': { windowId: string; from: WindowModeKind; to: WindowModeKind };
  'screen:toggled': { open: boolean };
  'player:interact': { targetId: string };
  'quality:changed': { tier: QualityTier; reason: 'user' | 'auto' };
  'shell:stateChanged': { from: ShellState; to: ShellState };
  'window:autoPinned': { windowId: string; reason: 'lockLost' };
  'gl:contextLost': Record<string, never>;
  'gl:contextRestored': Record<string, never>;
  'audio:muteChanged': { muted: boolean };
}
