import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { SharedPostTextureRepository } from "../src/scene/SharedPostTextureRepository";

describe("SharedPostTextureRepository", () => {
  it("loads the same source once and shares its texture", async () => {
    const texture = new THREE.Texture();
    const loader = vi.fn(async () => texture);
    const repository = new SharedPostTextureRepository(loader);

    const [first, second] = await Promise.all([
      repository.load("/shared.svg"),
      repository.load("/shared.svg"),
    ]);

    expect(loader).toHaveBeenCalledOnce();
    expect(first).toBe(second);
    expect(first.userData.sharedResource).toBe(true);
  });

  it("disposes a shared texture once through its owner", async () => {
    const texture = new THREE.Texture();
    const dispose = vi.spyOn(texture, "dispose");
    const repository = new SharedPostTextureRepository(async () => texture);
    await repository.load("/shared.svg");

    repository.dispose();
    repository.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });
});
