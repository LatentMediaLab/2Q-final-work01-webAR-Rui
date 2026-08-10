import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { disposeObject3D } from "../src/scene/disposeObject3D";

describe("disposeObject3D", () => {
  it("disposes geometry, material, and every attached texture once", () => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(geometry, material),
      new THREE.Mesh(geometry, material),
    );

    disposeObject3D(group);

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it("leaves explicitly shared materials for their owning pool", () => {
    const material = new THREE.MeshBasicMaterial();
    material.userData.sharedResource = true;
    const dispose = vi.spyOn(material, "dispose");
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);

    disposeObject3D(mesh);

    expect(dispose).not.toHaveBeenCalled();
  });

  it("leaves a shared texture for its repository while disposing its material", () => {
    const texture = new THREE.Texture();
    texture.userData.sharedResource = true;
    const textureDispose = vi.spyOn(texture, "dispose");
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const materialDispose = vi.spyOn(material, "dispose");
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);

    disposeObject3D(mesh);

    expect(textureDispose).not.toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});
