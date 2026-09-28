import type { ComponentType } from 'react';
import type { WindowModeKind } from '@/contracts/window';

export type AppIntegration =
  | { kind: 'native'; load: () => Promise<{ default: ComponentType<AppProps> }> }
  | { kind: 'embed'; url: string; sandbox: string; allow?: string; fallback: 'external' | 'none' }
  | { kind: 'external'; url: string };

export interface AppCapabilities {
  textInput: boolean;
  audio?: boolean;
  network?: boolean;
  storage?: 'local' | 'none';
  xrSafe?: boolean;
}

export interface AppWindowSpec {
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  resizable: boolean;
  singleton: boolean;
  allowedModes: WindowModeKind[];
}

export interface AppDefinition {
  id: string;
  version: number;
  title: string;
  icon: string;
  category: 'productivity' | 'social' | 'media' | 'system' | 'fun';
  integration: AppIntegration;
  capabilities: AppCapabilities;
  window: AppWindowSpec;
}

export interface NamespacedStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface AppHostApi {
  setTitle(title: string): void;
  close(): void;
  requestFocus(): void;
  storage: NamespacedStorage;
  emit: (type: string, payload: unknown) => void;
}

export interface AppProps {
  windowId: string;
  host: AppHostApi;
}
