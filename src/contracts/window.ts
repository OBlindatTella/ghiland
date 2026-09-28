import type { ScreenRect, Vec3, Quat } from '@/contracts/math';

export type WindowModeKind = 'overlay' | 'detached' | 'worldPinned';

export type WindowMode =
  | { kind: 'overlay'; rect: ScreenRect }
  | {
      kind: 'detached';
      offset: Vec3;
      lagMs: number;
    }
  | {
      kind: 'worldPinned';
      worldId: string;
      position: Vec3;
      quaternion: Quat;
      pxPerMeter: 520;
      anchorId?: string;
      placement: 'anchor' | 'surface' | 'float';
    };

export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  mode: WindowMode;
  lastScreenRect: ScreenRect;
  state: WindowState;
  z: number;
  owner: 'local';
  createdAt: number;
}

export interface ProjectionContext {
  viewProjection: readonly number[];
  viewport: { width: number; height: number };
  cameraPosition: Vec3;
}

export interface WindowModeHandler<K extends WindowModeKind = WindowModeKind> {
  kind: K;
  space: 'screen' | 'camera' | 'world';
  inputPolicy: 'ui' | 'world' | 'world-until-focused';
  project?(mode: Extract<WindowMode, { kind: K }>, ctx: ProjectionContext): string | null;
}
