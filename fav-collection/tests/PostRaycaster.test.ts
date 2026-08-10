import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  findPostIdFromObject,
  PostRaycaster,
} from "../src/interaction/PostRaycaster";

describe("findPostIdFromObject", () => {
  it("finds the post ID assigned to a selectable parent group", () => {
    const group = new THREE.Group();
    group.userData.postId = "post-parent";
    const child = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    group.add(child);

    expect(findPostIdFromObject(child)).toBe("post-parent");
    child.geometry.dispose();
  });

  it("returns null outside a selectable post object", () => {
    expect(findPostIdFromObject(new THREE.Group())).toBeNull();
  });
});

describe("PostRaycaster.pickPostIdFromRay", () => {
  it("selects an AR post along the input source ray", () => {
    const group = new THREE.Group();
    group.userData.postId = "ar-post";
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial();
    group.add(new THREE.Mesh(geometry, material));
    group.updateMatrixWorld(true);

    const postId = new PostRaycaster().pickPostIdFromRay(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
      [group],
    );

    expect(postId).toBe("ar-post");
    geometry.dispose();
    material.dispose();
  });
});
