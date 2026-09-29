'use client';

import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Camera } from 'three';
import type { WindowInstance } from '@/contracts/window';
import { PROJECTOR_FRAME_PRIORITY } from '@/engine/render/frameOrder';
import {
  autoPinCarried,
  detachWindow,
  focusPinnedFromWorld,
  onInteractKey,
  onPinKey,
  persistWindows,
  pinTarget,
  recallCarried,
  restorePinnedForWorld,
  returnWindowToScreen,
} from '@/engine/windows/actions';
import { carryTarget, clearCarry, stepCarry } from '@/engine/windows/carryPose';
import { onCrosshairHit, setWindowQuads, type WindowQuad } from '@/engine/windows/crosshair';
import { ghostElement, stageElement, windowElement } from '@/engine/windows/domRegistry';
import { inputManager } from '@/engine/input/InputManager';
import { installWindowBridge } from '@/engine/windows/bridge';
import { physicalSize, rayAabb, resolvePlacement, type PlacementBounds, type PlacementCollider } from '@/engine/windows/placement';
import { blocksOcclusion } from '@/engine/windows/raySets';
import { cameraStageTransform, projectWindow } from '@/engine/windows/projector';
import { frontFacesView, windowFrontNormal } from '@/shell/windows/frameBack';
import { getWorld } from '@/worlds/registry';
import { useGlStore } from '@/state/gl';
import { useSession } from '@/state/session';
import { useWindows } from '@/state/windows';

const FADE_SECONDS = 0.2;
const occlusion = new Map<string, { target: number; value: number; clock: number }>();
const forward = new Vector3();

function colliders(): PlacementCollider[] {
  const id = useSession.getState().worldId;
  const world = id ? getWorld(id) : undefined;
  if (!world || world.collision.kind !== 'boxes') return [];
  return world.collision.colliders;
}

function occluders(): PlacementCollider[] {
  return colliders().filter((item) => blocksOcclusion(item.layers));
}

function syncQuads(windows: WindowInstance[]): void {
  const quads: WindowQuad[] = [];
  for (const item of windows) {
    if (item.mode.kind !== 'worldPinned' || item.state === 'minimized') continue;
    const size = physicalSize(item.lastScreenRect.w, item.lastScreenRect.h);
    quads.push({
      id: item.id,
      position: item.mode.position,
      quaternion: item.mode.quaternion,
      half: { w: size.w / 2, h: size.h / 2 },
    });
  }
  setWindowQuads(quads);
}

function paintGhost(camera: Camera, carried: WindowInstance | null): void {
  const ghost = ghostElement();
  if (!ghost) return;
  if (!carried) {
    ghost.hidden = true;
    return;
  }
  const pose = cameraPoseSafe(camera);
  if (!pose) {
    ghost.hidden = true;
    return;
  }
  const worldId = useSession.getState().worldId;
  const world = worldId ? getWorld(worldId) : undefined;
  const occupied = new Set<string>();
  for (const item of Object.values(useWindows.getState().windows)) {
    if (item.id === carried.id || item.mode.kind !== 'worldPinned' || !item.mode.anchorId) continue;
    occupied.add(item.mode.anchorId);
  }
  const rail = world?.collision.kind === 'boxes' ? world.collision.colliders.find((item) => item.id === 'rail-north') : undefined;
  const walk = world?.collision.kind === 'boxes' ? world.collision.walkable : undefined;
  const bounds: PlacementBounds | undefined = walk
    ? {
        min: [walk.min[0], walk.min[1], walk.min[2]],
        max: [walk.max[0], walk.max[1], walk.max[2]],
        floorY: world?.collision.kind === 'boxes' ? world.collision.floorY : 0,
        ceilingY: pose.origin[2] > 4.5 ? null : pose.origin[2] < -3.5 ? 2.4 : 3.2,
        railZ: rail ? rail.box.min[2] : null,
      }
    : undefined;
  const placement = resolvePlacement({
    ray: { origin: pose.origin, direction: pose.direction },
    colliders: colliders(),
    anchors: world?.pinAnchors ?? [],
    occupied,
    heightPx: carried.lastScreenRect.h,
    widthPx: carried.lastScreenRect.w,
    bounds,
  });
  const projected = projectWindow(camera, placement.position, placement.quaternion);
  ghost.hidden = projected.behind || !projected.object;
  ghost.dataset.valid = placement.valid ? 'true' : 'false';
  ghost.dataset.taken = placement.taken ? 'true' : 'false';
  ghost.dataset.placement = placement.placement;
  ghost.style.width = `${carried.lastScreenRect.w}px`;
  ghost.style.height = `${carried.lastScreenRect.h}px`;
  ghost.style.transformOrigin = '0 0';
  if (projected.object) ghost.style.transform = projected.object;
  ghost.style.outlineColor = !placement.valid ? '#c45c4a' : placement.taken ? '#d7b15e' : '#86bdb2';
}

function cameraPoseSafe(camera: Camera): {
  origin: [number, number, number];
  direction: [number, number, number];
  quaternion: [number, number, number, number];
} | null {
  camera.updateMatrixWorld();
  camera.getWorldDirection(forward);
  if (!Number.isFinite(forward.x)) return null;
  const origin = camera.position;
  const quaternion = camera.quaternion;
  return {
    origin: [origin.x, origin.y, origin.z],
    direction: [forward.x, forward.y, forward.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
}

export function WindowRig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    installWindowBridge({
      pin: pinTarget,
      detach: detachWindow,
      recall: returnWindowToScreen,
    });
    inputManager.setWindowHooks({
      pin: onPinKey,
      interact: onInteractKey,
      recall: recallCarried,
    });
    inputManager.setBeforeShellChange((from, to) => {
      if (from === 'WORLD' && to !== 'WORLD') autoPinCarried();
    });
    const unhit = onCrosshairHit((id, point) => focusPinnedFromWorld(id, point));
    const unsub = useWindows.subscribe(() => persistWindows());
    const onHide = () => persistWindows();
    window.addEventListener('pagehide', onHide);
    const ungl = useGlStore.subscribe((state, prev) => {
      if (!state.lost || prev.lost) return;
      const stage = stageElement();
      if (stage) stage.style.transform = '';
      const ghost = ghostElement();
      if (ghost) ghost.style.transform = '';
      for (const item of Object.values(useWindows.getState().windows)) {
        const element = windowElement(item.id);
        if (!element) continue;
        element.style.transform = '';
      }
    });
    return () => {
      installWindowBridge(null);
      inputManager.setWindowHooks(null);
      inputManager.setBeforeShellChange(null);
      unhit();
      unsub();
      ungl();
      occlusion.clear();
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  useEffect(() => {
    const current = useSession.getState();
    if (current.worldPhase === 'active' && current.worldId) restorePinnedForWorld(current.worldId);
    return useSession.subscribe((state, previous) => {
      if (state.worldId !== previous.worldId) {
        for (const item of Object.values(useWindows.getState().windows)) {
          if (item.mode.kind === 'worldPinned' && item.mode.worldId !== state.worldId) {
            const element = windowElement(item.id);
            if (element) element.style.transform = '';
            occlusion.delete(item.id);
            clearCarry(item.id);
            useWindows.getState().close(item.id);
          }
        }
      }
      if (state.worldPhase === 'active' && state.worldId && (previous.worldPhase !== 'active' || previous.worldId !== state.worldId)) {
        restorePinnedForWorld(state.worldId);
      }
    });
  }, []);

  useFrame((_, dt) => {
    const stage = stageElement();
    const view = size.height > 0 ? size : { width: window.innerWidth, height: window.innerHeight };
    if (stage) stage.style.transform = cameraStageTransform(camera, view.width, view.height);
    const windows = Object.values(useWindows.getState().windows);
    const live = new Set(windows.map((item) => item.id));
    for (const id of occlusion.keys()) {
      if (!live.has(id)) occlusion.delete(id);
    }
    syncQuads(windows);
    const pose = cameraPoseSafe(camera);
    let carried: WindowInstance | null = null;
    for (const item of windows) {
      const element = windowElement(item.id);
      if (!element) continue;
      if (useWindows.getState().closingIds.includes(item.id)) {
        element.style.transition = 'opacity 120ms linear';
        element.style.opacity = '0';
        continue;
      }
      if (item.mode.kind === 'overlay' || item.state === 'minimized') {
        element.style.transform = '';
        element.style.visibility = '';
        element.style.opacity = '';
        if (item.mode.kind !== 'detached') clearCarry(item.id);
        continue;
      }
      let worldPosition = item.mode.kind === 'worldPinned' ? item.mode.position : null;
      let worldQuaternion = item.mode.kind === 'worldPinned' ? item.mode.quaternion : null;
      if (item.mode.kind === 'detached' && pose) {
        carried = item;
        const target = carryTarget(pose.origin, pose.direction, pose.quaternion);
        const lagged = stepCarry(item.id, target, dt);
        worldPosition = lagged.position;
        worldQuaternion = lagged.quaternion;
      }
      if (!worldPosition || !worldQuaternion) continue;
      const projected = projectWindow(camera, worldPosition, worldQuaternion);
      element.style.width = `${item.lastScreenRect.w}px`;
      element.style.height = `${item.lastScreenRect.h}px`;
      element.style.transformOrigin = '0 0';
      if (!projected.object) {
        element.style.visibility = 'hidden';
        continue;
      }
      element.style.visibility = 'visible';
      element.style.transform = projected.object;
      if (pose) {
        const view: [number, number, number] = [
          worldPosition[0] - pose.origin[0],
          worldPosition[1] - pose.origin[1],
          worldPosition[2] - pose.origin[2],
        ];
        const front = frontFacesView(windowFrontNormal(worldQuaternion), view);
        element.style.pointerEvents = front ? 'auto' : 'none';
        element.toggleAttribute('data-facing-back', !front);
      }
      if (item.mode.kind !== 'worldPinned') {
        element.style.opacity = '1';
        continue;
      }
      const sample = occlusion.get(item.id) ?? { target: 1, value: 1, clock: 0 };
      sample.clock += dt;
      if (sample.clock >= 0.1 && pose) {
        sample.clock = 0;
        const delta = [
          worldPosition[0] - pose.origin[0],
          worldPosition[1] - pose.origin[1],
          worldPosition[2] - pose.origin[2],
        ] as [number, number, number];
        const span = Math.hypot(delta[0], delta[1], delta[2]);
        const direction = span > 1e-4 ? [delta[0] / span, delta[1] / span, delta[2] / span] as [number, number, number] : [0, 0, -1] as [number, number, number];
        let blocked = false;
        for (const box of occluders()) {
          const hit = rayAabb(pose.origin, direction, box.box, span - 0.05);
          if (hit) {
            blocked = true;
            break;
          }
        }
        sample.target = blocked ? 0 : 1;
      }
      const step = Math.min(1, dt / FADE_SECONDS);
      sample.value += (sample.target - sample.value) * step;
      occlusion.set(item.id, sample);
      element.style.opacity = String(sample.value);
    }
    paintGhost(camera, carried);
  }, PROJECTOR_FRAME_PRIORITY);

  return null;
}
