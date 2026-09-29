import { Matrix4, Quaternion, Vector3, type Camera } from 'three';
import type { Quat, Vec3 } from '@/contracts/math';
import { PX_PER_METER } from '@/engine/windows/placement';

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3(1, 1, 1);
const matrix = new Matrix4();
const inverse = new Matrix4();
const cameraSpace = new Vector3();

function epsilon(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

/** three.js CSS3DRenderer camera matrix, Y flipped into CSS. */
export function cameraCssMatrix(elements: ArrayLike<number>): string {
  return (
    'matrix3d(' +
    [
      epsilon(elements[0] ?? 0),
      epsilon(-(elements[1] ?? 0)),
      epsilon(elements[2] ?? 0),
      epsilon(elements[3] ?? 0),
      epsilon(elements[4] ?? 0),
      epsilon(-(elements[5] ?? 0)),
      epsilon(elements[6] ?? 0),
      epsilon(elements[7] ?? 0),
      epsilon(elements[8] ?? 0),
      epsilon(-(elements[9] ?? 0)),
      epsilon(elements[10] ?? 0),
      epsilon(elements[11] ?? 0),
      epsilon(elements[12] ?? 0),
      epsilon(-(elements[13] ?? 0)),
      epsilon(elements[14] ?? 0),
      epsilon(elements[15] ?? 0),
    ].join(',') +
    ')'
  );
}

/** three.js CSS3DRenderer object matrix. Includes the centre offset. */
export function objectCssMatrix(elements: ArrayLike<number>): string {
  const matrix3d =
    'matrix3d(' +
    [
      epsilon(elements[0] ?? 0),
      epsilon(elements[1] ?? 0),
      epsilon(elements[2] ?? 0),
      epsilon(elements[3] ?? 0),
      epsilon(-(elements[4] ?? 0)),
      epsilon(-(elements[5] ?? 0)),
      epsilon(-(elements[6] ?? 0)),
      epsilon(-(elements[7] ?? 0)),
      epsilon(elements[8] ?? 0),
      epsilon(elements[9] ?? 0),
      epsilon(elements[10] ?? 0),
      epsilon(elements[11] ?? 0),
      epsilon(elements[12] ?? 0),
      epsilon(elements[13] ?? 0),
      epsilon(elements[14] ?? 0),
      epsilon(elements[15] ?? 0),
    ].join(',') +
    ')';
  // Percentage offset is applied in element pixels, then the world matrix scales it with the window.
  return `${matrix3d} translate(-50%,-50%)`;
}

/** Full camera-element transform, including the viewport centre. Width and height are CSS pixels. */
/**
 * CSS3DRenderer treats matrix units as pixels. The world is in metres, so translations
 * are scaled by 520 px/m. Rotations stay put. The half-viewport translate then shares that space.
 */
function pixelCameraElements(camera: Camera): number[] {
  const elements = Array.from(camera.matrixWorldInverse.elements);
  elements[12] = (elements[12] ?? 0) * PX_PER_METER;
  elements[13] = (elements[13] ?? 0) * PX_PER_METER;
  elements[14] = (elements[14] ?? 0) * PX_PER_METER;
  return elements;
}

export function cameraStageTransform(camera: Camera, width: number, height: number): string {
  camera.updateMatrixWorld();
  const halfH = height / 2;
  const fov = (camera.projectionMatrix.elements[5] ?? 1) * halfH;
  // The half-viewport translate is applied last so it stays in screen pixels after perspective.
  return `translate(${width / 2}px,${height / 2}px)perspective(${fov}px) translateZ(${fov}px)${cameraCssMatrix(pixelCameraElements(camera))}`;
}

export interface ProjectedWindow {
  /** Object transform inside the camera stage. Null when the window is behind the camera. */
  object: string | null;
  behind: boolean;
}

/**
 * CSS matrix3d for one window. Scale is 1/520 so CSS pixels stay 1:1 in the layout
 * and the world size is px / 520. Nothing here rasterizes the content.
 */
export function projectWindow(
  camera: Camera,
  worldPosition: Vec3,
  worldQuaternion: Quat,
): ProjectedWindow {
  camera.updateMatrixWorld();
  inverse.copy(camera.matrixWorldInverse);
  cameraSpace.set(worldPosition[0], worldPosition[1], worldPosition[2]).applyMatrix4(inverse);
  if (cameraSpace.z > -0.05) return { object: null, behind: true };
  position.set(worldPosition[0] * PX_PER_METER, worldPosition[1] * PX_PER_METER, worldPosition[2] * PX_PER_METER);
  quaternion.set(worldQuaternion[0], worldQuaternion[1], worldQuaternion[2], worldQuaternion[3]);
  scale.set(1, 1, 1);
  matrix.compose(position, quaternion, scale);
  return { object: objectCssMatrix(matrix.elements), behind: false };
}
