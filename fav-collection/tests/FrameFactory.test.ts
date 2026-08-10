import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createFrame,
  disposeSharedFrameMaterials,
} from "../src/scene/FrameFactory";
import { disposeObject3D } from "../src/scene/disposeObject3D";

describe("FrameFactory shared resources", () => {
  it("reuses bounded frame materials across exhibits", () => {
    const first = createFrame(1, 1, "brass");
    const second = createFrame(0.8, 0.6, "brass");
    const firstMaterials = collectMaterials(first);
    const secondMaterials = collectMaterials(second);

    expect(firstMaterials[0]).toBe(secondMaterials[0]);
    expect(firstMaterials[1]).toBe(secondMaterials[1]);

    disposeObject3D(first);
    disposeObject3D(second);
    disposeSharedFrameMaterials();
  });
});

function collectMaterials(group: THREE.Group): THREE.Material[] {
  const materials: THREE.Material[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      materials.push(
        ...(Array.isArray(object.material)
          ? object.material
          : [object.material]),
      );
    }
  });
  return [...new Set(materials)];
}
