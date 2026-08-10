import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { getTargetRay, resolveWallPlacement } from "../src/ar/placement";

describe("resolveWallPlacement", () => {
  it("keeps the exhibition vertical and faces the viewer as fallback", () => {
    const hitMatrix = new THREE.Matrix4().makeTranslation(1, 1.2, 0);
    const result = resolveWallPlacement(
      hitMatrix.elements,
      new THREE.Vector3(1, 1.6, 2),
      0.025,
    );

    expect(result.usedSurfaceOrientation).toBe(false);
    expect(result.position.x).toBeCloseTo(1);
    expect(result.position.y).toBeCloseTo(1.2);
    expect(result.position.z).toBeCloseTo(0.025);
    expect(new THREE.Euler().setFromQuaternion(result.quaternion).x).toBeCloseTo(
      0,
    );
  });

  it("uses a stable vertical surface normal", () => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 1, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      ),
      new THREE.Vector3(1, 1, 1),
    );
    const result = resolveWallPlacement(
      matrix.elements,
      new THREE.Vector3(0, 1, 2),
      0.02,
    );

    expect(result.usedSurfaceOrientation).toBe(true);
    expect(result.position.z).toBeCloseTo(0.02);
  });
});

describe("getTargetRay", () => {
  it("creates a forward -Z ray from an XR target pose", () => {
    const matrix = new THREE.Matrix4().makeTranslation(1, 2, 3);
    const ray = getTargetRay(matrix.elements);

    expect(ray.origin.toArray()).toEqual([1, 2, 3]);
    expect(ray.direction.x).toBeCloseTo(0);
    expect(ray.direction.y).toBeCloseTo(0);
    expect(ray.direction.z).toBeCloseTo(-1);
  });
});
