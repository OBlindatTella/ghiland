import type { WindowInstance } from '@/contracts/window';
import { getWorld } from '@/worlds/registry';
import { inputManager } from '@/engine/input/InputManager';
import { carryTarget, clearCarry, readCarry, seedCarry } from '@/engine/windows/carryPose';
import { cameraPose, queryCrosshair } from '@/engine/windows/crosshair';
import { autoPinPlacement, resolvePlacement, type PlacementBounds, type PlacementCollider } from '@/engine/windows/placement';
import { fileFromWindows, readWindowsFile, writeWindowsFile } from '@/shell/windows/persistence';
import { useInputStore } from '@/state/input';
import { useSession } from '@/state/session';
import { useWindows } from '@/state/windows';

function placementBounds(eyeZ: number): PlacementBounds | undefined {
  const id = useSession.getState().worldId;
  if (!id) return undefined;
  const world = getWorld(id);
  if (!world || world.collision.kind !== 'boxes') return undefined;
  const rail = world.collision.colliders.find((item) => item.id === 'rail-north');
  const walk = world.collision.walkable;
  return {
    min: [walk.min[0], walk.min[1], walk.min[2]],
    max: [walk.max[0], walk.max[1], walk.max[2]],
    floorY: world.collision.floorY,
    ceilingY: eyeZ > 4.5 ? null : eyeZ < -3.5 ? 2.4 : 3.2,
    railZ: rail ? rail.box.min[2] : null,
  };
}

function worldColliders(): PlacementCollider[] {
  const id = useSession.getState().worldId;
  if (!id) return [];
  const world = getWorld(id);
  if (!world || world.collision.kind !== 'boxes') return [];
  return world.collision.colliders;
}

function anchors() {
  const id = useSession.getState().worldId;
  if (!id) return [];
  return getWorld(id)?.pinAnchors ?? [];
}

function occupied(exceptId: string): Set<string> {
  const ids = new Set<string>();
  for (const item of Object.values(useWindows.getState().windows)) {
    if (item.id === exceptId || item.mode.kind !== 'worldPinned' || !item.mode.anchorId) continue;
    ids.add(item.mode.anchorId);
  }
  return ids;
}

function detached(): WindowInstance | null {
  return Object.values(useWindows.getState().windows).find((item) => item.mode.kind === 'detached') ?? null;
}

export function persistWindows(): void {
  const previous = readWindowsFile();
  writeWindowsFile(fileFromWindows(Object.values(useWindows.getState().windows), previous));
}

export function restorePinnedForWorld(worldId: string): void {
  const file = readWindowsFile();
  useWindows.getState().restoreWorld(
    file.pinned.filter((item) => item.worldId === worldId),
    file.rects,
  );
}

function overlayMode(item: WindowInstance): void {
  clearCarry(item.id);
  useWindows.getState().setMode(item.id, { kind: 'overlay', rect: item.lastScreenRect });
}

/** Q returns a carried window to the Screen before the shell changes, so it is not auto-pinned. */
export function recallCarried(): void {
  const item = detached();
  if (!item) return;
  overlayMode(item);
  persistWindows();
}

export function detachWindow(id: string): void {
  const item = useWindows.getState().windows[id];
  const pose = cameraPose();
  if (!item || item.mode.kind !== 'overlay' || !pose) return;
  const target = carryTarget(pose.origin, pose.direction, pose.quaternion);
  seedCarry(id, target.position, target.quaternion);
  useWindows.getState().setMode(id, { kind: 'detached', offset: [0, 0, -1.1], lagMs: 150 });
  if (useInputStore.getState().shellState !== 'WORLD') inputManager.presentWorld();
}

export function returnWindowToScreen(id: string): void {
  const item = useWindows.getState().windows[id];
  if (!item || item.mode.kind === 'overlay') return;
  overlayMode(item);
  persistWindows();
  if (useInputStore.getState().shellState === 'WORLD') inputManager.presentScreen();
}

function pinWindow(id: string): boolean {
  const item = useWindows.getState().windows[id];
  const pose = cameraPose();
  const worldId = useSession.getState().worldId;
  if (!item || !pose || !worldId) return false;
  if (item.mode.kind === 'worldPinned') return false;
  const placement = resolvePlacement({
    ray: { origin: pose.origin, direction: pose.direction },
    colliders: worldColliders(),
    anchors: anchors(),
    occupied: occupied(id),
    heightPx: item.lastScreenRect.h,
    widthPx: item.lastScreenRect.w,
    bounds: placementBounds(pose.origin[2]),
  });
  if (!placement.valid) return false;
  clearCarry(id);
  useWindows.getState().setMode(id, {
    kind: 'worldPinned',
    worldId,
    position: placement.position,
    quaternion: placement.quaternion,
    pxPerMeter: 520,
    placement: placement.placement,
    anchorId: placement.anchorId,
  });
  persistWindows();
  return true;
}

export function pinTarget(id: string): void {
  pinWindow(id);
}

/** D-017. Called from setBeforeShellChange, including context loss. */
export function autoPinCarried(): void {
  const item = detached();
  const pose = cameraPose();
  const worldId = useSession.getState().worldId;
  if (!item || !worldId) return;
  const carried = readCarry(item.id) ?? (pose ? carryTarget(pose.origin, pose.direction, pose.quaternion) : null);
  if (!carried) return;
  const eye = pose?.origin ?? carried.position;
  const placement = autoPinPlacement(eye, carried.position, carried.quaternion, worldColliders(), placementBounds(eye[2]), item.lastScreenRect.h);
  clearCarry(item.id);
  useWindows.getState().setMode(item.id, {
    kind: 'worldPinned',
    worldId,
    position: placement.position,
    quaternion: placement.quaternion,
    pxPerMeter: 520,
    placement: 'float',
  });
  persistWindows();
}

export function onPinKey(): void {
  const carried = detached();
  if (carried) {
    pinWindow(carried.id);
    return;
  }
  const focused = useWindows.getState().focusedId;
  const item = focused ? useWindows.getState().windows[focused] : null;
  if (item?.mode.kind === 'overlay' && useInputStore.getState().shellState === 'SCREEN') pinWindow(item.id);
}

export function onInteractKey(): void {
  const carried = detached();
  if (carried) {
    pinWindow(carried.id);
    return;
  }
  if (useInputStore.getState().shellState !== 'WORLD') return;
  const hit = queryCrosshair();
  const item = hit ? useWindows.getState().windows[hit] : null;
  const pose = cameraPose();
  if (!item || item.mode.kind !== 'worldPinned' || !pose) return;
  seedCarry(item.id, item.mode.position, item.mode.quaternion);
  useWindows.getState().setMode(item.id, { kind: 'detached', offset: [0, 0, -1.1], lagMs: 150 });
}

/** Aim and click a pinned window: SCREEN, focused, camera stays. */
export function focusPinnedFromWorld(id: string): void {
  const item = useWindows.getState().windows[id];
  if (!item || item.mode.kind !== 'worldPinned') return;
  if (useInputStore.getState().shellState !== 'WORLD') return;
  useWindows.getState().focus(id);
  inputManager.presentScreen();
  window.setTimeout(() => {
    const field = document.querySelector<HTMLElement>(`[data-ghiland-window="${id}"] textarea, [data-ghiland-window="${id}"] input`);
    field?.focus();
  }, 0);
}
