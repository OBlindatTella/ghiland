export type InputOwner =
  | 'world'
  | 'ui'
  | 'text'
  | 'system';

export type Action =
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'strollFast'
  | 'toggleScreen'
  | 'interact'
  | 'pin'
  | 'toggleMute'
  | 'togglePerfHud'
  | 'openLauncher'
  | 'escape';

/** `codes` are `KeyboardEvent.code` values. */
export interface KeyBinding {
  action: Action;
  codes: string[];
  owners: InputOwner[];
}

export type ShellState = 'WORLD' | 'SCREEN' | 'RELEASED';

export interface MovementSpec {
  walkSpeed: number;
  strollFastSpeed: number;
  backMultiplier: number;
  strafeMultiplier: number;
  eyeHeight: number;
  capsule: { height: number; radius: number };
}
