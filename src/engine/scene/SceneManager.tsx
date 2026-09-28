'use client';

import { useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import type { QualityProfile } from '@/contracts/quality';
import type { Collider, WorldModule } from '@/contracts/world';
import { disposeObject3D } from '@/engine/scene/dispose';
import { StableFrames } from '@/engine/scene/StableFrames';
import { FirstPersonController } from '@/engine/player/FirstPersonController';
import { qualityProfiles } from '@/engine/quality/profiles';
import { useAppliedQuality } from '@/state/appliedQuality';
import { useSession } from '@/state/session';
import { getWorld } from '@/worlds/registry';

function WorldHost({
  module,
  spawn,
  colliders,
  quality,
}: {
  module: WorldModule;
  spawn: { x: number; y: number; z: number };
  colliders: readonly Collider[];
  quality: QualityProfile;
}) {
  const group = useRef<Group>(null);
  const Scene = module.Scene;

  useEffect(() => {
    const root = group.current;
    return () => {
      if (root) disposeObject3D(root);
      module.dispose?.();
    };
  }, [module]);

  return (
    <group ref={group}>
      <Scene
        quality={quality}
        onReady={() => {
          useSession.getState().setProgress(0.9);
        }}
      />
      <FirstPersonController spawn={spawn} colliders={colliders} />
      <StableFrames
        onStable={() => {
          useSession.getState().setProgress(1);
        }}
      />
    </group>
  );
}

export function SceneManager() {
  const worldId = useSession((state) => state.worldId);
  const tier = useAppliedQuality((state) => state.tier);
  const [module, setModule] = useState<WorldModule | null>(null);

  useEffect(() => {
    if (!worldId) return;
    const definition = getWorld(worldId);
    if (!definition?.load) return;
    let cancelled = false;
    useSession.getState().setProgress(0.22);
    void definition.load().then(async (loaded) => {
      if (cancelled) {
        loaded.default.dispose?.();
        return;
      }
      useSession.getState().setProgress(0.58);
      await loaded.default.preload?.();
      if (cancelled) {
        loaded.default.dispose?.();
        return;
      }
      useSession.getState().setProgress(0.74);
      setModule(loaded.default);
    });
    return () => {
      cancelled = true;
      setModule(null);
    };
  }, [worldId]);

  if (!module || !worldId) return null;
  const definition = getWorld(worldId);
  if (!definition || definition.collision.kind !== 'boxes') return null;
  const [x, y, z] = definition.spawn.position;

  return (
    <WorldHost
      module={module}
      quality={qualityProfiles[tier]}
      spawn={{ x, y, z }}
      colliders={definition.collision.colliders}
    />
  );
}
