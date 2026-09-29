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
  return `translate(-50%,-50%)${matrix3d}`;
}

/** Full camera-element transform, including the viewport centre. Width and height are CSS pixels. */
export function cameraStageTransform(camera: Camera, width: number, height: number): string {
  camera.updateMatrixWorld();
  const halfH = height / 2;
  const fov = (camera.projectionMatrix.elements[5] ?? 1) * halfH;
  return `perspective(${fov}px) translateZ(${fov}px)${cameraCssMatrix(camera.matrixWorldInverse.elements)}translate(${width / 2}px,${height / 2}px)`;
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
  position.set(worldPosition[0], worldPosition[1], worldPosition[2]);
  quaternion.set(worldQuaternion[0], worldQuaternion[1], worldQuaternion[2], worldQuaternion[3]);
  scale.set(1 / PX_PER_METER, 1 / PX_PER_METER, 1 / PX_PER_METER);
  matrix.compose(position, quaternion, scale);
  return { object: objectCssMatrix(matrix.elements), behind: false };
}
