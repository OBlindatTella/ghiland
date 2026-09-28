import type { ComponentType } from 'react';
import type { WorldAudioSpec } from '@/contracts/audio';
import type { AcousticPortal, EnvironmentPreset, WorldZone } from '@/contracts/environment';
import type { MovementSpec } from '@/contracts/input';
import type { AABB, Quat, Vec3 } from '@/contracts/math';
import type { PerfBudget, QualityProfile, QualityTier } from '@/contracts/quality';

export type WorldStatus = 'playable' | 'preview';

export type ColliderLayer = 'movement' | 'occluder' | 'pinSurface' | 'placement';

export interface Collider {
  id: string;
  box: AABB;
  layers: ColliderLayer[];
}

export type CollisionSpec =
  | { kind: 'boxes'; walkable: AABB; colliders: Collider[]; floorY: number }
  | { kind: 'mesh'; url: string };

export interface PinAnchor {
  id: string;
  position: Vec3;
  quaternion: Quat;
  label?: string;
  defaultSize?: { w: number; h: number };
}

export interface WorldSceneProps {
  quality: QualityProfile;
  onReady: () => void;
}

export interface WorldModule {
  Scene: ComponentType<WorldSceneProps>;
  preload?: () => Promise<void>;
  dispose?: () => void;
}

export interface WorldDefinition {
  id: string;
  version: number;
  title: string;
  tagline?: string;
  status: WorldStatus;
  thumbnail: string;
  load?: () => Promise<{ default: WorldModule }>;
  spawn: { position: Vec3; yaw: number; pitch?: number };
  collision: CollisionSpec;
  environment: EnvironmentPreset;
  zones: WorldZone[];
  portals?: AcousticPortal[];
  audio?: WorldAudioSpec;
  movement?: Partial<MovementSpec>;
  pinAnchors?: PinAnchor[];
  quality?: Partial<Record<QualityTier, Partial<QualityProfile>>>;
  budget?: Partial<PerfBudget>;
}

export type WorldPhase = 'idle' | 'loading' | 'ready' | 'entering' | 'active' | 'exiting';
