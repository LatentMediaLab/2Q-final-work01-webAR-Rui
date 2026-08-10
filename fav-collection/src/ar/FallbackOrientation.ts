import * as THREE from "three";

export interface DeviceOrientationSample {
  readonly alpha: number;
  readonly beta: number;
  readonly gamma: number;
  readonly screenAngle: number;
}

export interface DeviceOrientationPermissionRequester {
  requestPermission?: () => Promise<string>;
}

export type DeviceOrientationAccess = "granted" | "denied" | "unavailable";

const DEVICE_TO_CAMERA = new THREE.Quaternion(
  -Math.sqrt(0.5),
  0,
  0,
  Math.sqrt(0.5),
);
const SCREEN_AXIS = new THREE.Vector3(0, 0, 1);

export async function requestDeviceOrientationAccess(
  requester: DeviceOrientationPermissionRequester | undefined,
): Promise<DeviceOrientationAccess> {
  if (requester === undefined) {
    return "unavailable";
  }
  if (requester.requestPermission === undefined) {
    return "granted";
  }

  try {
    return (await requester.requestPermission()) === "granted"
      ? "granted"
      : "denied";
  } catch {
    return "denied";
  }
}

export function createDeviceOrientationQuaternion(
  sample: DeviceOrientationSample,
): THREE.Quaternion {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(sample.beta),
    THREE.MathUtils.degToRad(sample.alpha),
    -THREE.MathUtils.degToRad(sample.gamma),
    "YXZ",
  );
  const screenRotation = new THREE.Quaternion().setFromAxisAngle(
    SCREEN_AXIS,
    -THREE.MathUtils.degToRad(sample.screenAngle),
  );

  return new THREE.Quaternion()
    .setFromEuler(euler)
    .multiply(DEVICE_TO_CAMERA)
    .multiply(screenRotation)
    .normalize();
}

export function createRelativeDeviceOrientation(
  reference: THREE.Quaternion,
  current: THREE.Quaternion,
): THREE.Quaternion {
  return reference.clone().invert().multiply(current).normalize();
}
