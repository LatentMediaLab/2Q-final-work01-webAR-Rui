import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { APP_CONFIG } from "../src/app/config";
import {
  createDeviceOrientationQuaternion,
  createRelativeDeviceOrientation,
  requestDeviceOrientationAccess,
} from "../src/ar/FallbackOrientation";

describe("fallback device orientation", () => {
  it("uses the wall-setting orientation as the virtual origin", () => {
    const reference = createDeviceOrientationQuaternion({
      alpha: 120,
      beta: 70,
      gamma: 4,
      screenAngle: 0,
    });
    const relative = createRelativeDeviceOrientation(reference, reference);

    expect(relative.angleTo(reference.clone().identity())).toBeCloseTo(0);
  });

  it("produces a visible camera rotation after the device turns", () => {
    const reference = createDeviceOrientationQuaternion({
      alpha: 120,
      beta: 70,
      gamma: 4,
      screenAngle: 0,
    });
    const current = createDeviceOrientationQuaternion({
      alpha: 160,
      beta: 70,
      gamma: 4,
      screenAngle: 0,
    });
    const relative = createRelativeDeviceOrientation(reference, current);

    expect(relative.angleTo(reference.clone().identity())).toBeGreaterThan(0.5);
  });

  it("allows the wall center to leave a portrait viewport", () => {
    const reference = createDeviceOrientationQuaternion({
      alpha: 120,
      beta: 70,
      gamma: 4,
      screenAngle: 0,
    });
    const current = createDeviceOrientationQuaternion({
      alpha: 160,
      beta: 70,
      gamma: 4,
      screenAngle: 0,
    });
    const camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.1, 100);
    camera.position.z = APP_CONFIG.fallback.cameraDistance;
    camera.quaternion.copy(
      createRelativeDeviceOrientation(reference, current),
    );
    camera.updateMatrixWorld();

    const projectedWallCenter = new THREE.Vector3(0, 0, 0).project(camera);
    expect(Math.abs(projectedWallCenter.x)).toBeGreaterThan(1);
  });

  it("requests iOS orientation permission when the API exposes it", async () => {
    const requestPermission = vi.fn(async () => "granted");

    await expect(
      requestDeviceOrientationAccess({ requestPermission }),
    ).resolves.toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("falls back to manual movement when orientation is unavailable", async () => {
    await expect(requestDeviceOrientationAccess(undefined)).resolves.toBe(
      "unavailable",
    );
    await expect(
      requestDeviceOrientationAccess({
        requestPermission: async () => "denied",
      }),
    ).resolves.toBe("denied");
  });
});
