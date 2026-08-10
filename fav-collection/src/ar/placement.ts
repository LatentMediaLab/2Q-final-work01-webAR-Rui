import * as THREE from "three";

export interface WallPlacementTransform {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly usedSurfaceOrientation: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const LOCAL_SURFACE_NORMAL = new THREE.Vector3(0, 1, 0);
const DEFAULT_FORWARD = new THREE.Vector3(0, 0, 1);

export function resolveWallPlacement(
  hitMatrix: ArrayLike<number>,
  viewerPosition: THREE.Vector3,
  wallOffset: number,
): WallPlacementTransform {
  const matrix = new THREE.Matrix4().fromArray(Array.from(hitMatrix));
  const hitPosition = new THREE.Vector3();
  const hitOrientation = new THREE.Quaternion();
  matrix.decompose(hitPosition, hitOrientation, new THREE.Vector3());

  const toViewer = viewerPosition.clone().sub(hitPosition);
  toViewer.y = 0;
  if (toViewer.lengthSq() < 0.000001) {
    toViewer.copy(DEFAULT_FORWARD);
  } else {
    toViewer.normalize();
  }

  const detectedNormal = LOCAL_SURFACE_NORMAL.clone()
    .applyQuaternion(hitOrientation)
    .normalize();
  const isVerticalSurface = Math.abs(detectedNormal.y) < 0.35;
  const forward = isVerticalSurface
    ? detectedNormal.setY(0).normalize()
    : toViewer.clone();

  if (forward.dot(toViewer) < 0) {
    forward.negate();
  }

  const yaw = Math.atan2(forward.x, forward.z);
  const quaternion = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const position = hitPosition.addScaledVector(forward, Math.max(0, wallOffset));

  return {
    position,
    quaternion,
    usedSurfaceOrientation: isVerticalSurface,
  };
}

export function getTargetRay(
  poseMatrix: ArrayLike<number>,
): { origin: THREE.Vector3; direction: THREE.Vector3 } {
  const matrix = new THREE.Matrix4().fromArray(Array.from(poseMatrix));
  const origin = new THREE.Vector3().setFromMatrixPosition(matrix);
  const direction = new THREE.Vector3(0, 0, -1).transformDirection(matrix);
  return { origin, direction };
}
