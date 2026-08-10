import * as THREE from "three";

export class PostRaycaster {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  public pickPostId(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    selectableObjects: readonly THREE.Object3D[],
  ): string | null {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, camera);

    return this.findPostId(selectableObjects);
  }

  public pickPostIdFromRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    selectableObjects: readonly THREE.Object3D[],
  ): string | null {
    this.raycaster.set(origin, direction.clone().normalize());
    return this.findPostId(selectableObjects);
  }

  private findPostId(
    selectableObjects: readonly THREE.Object3D[],
  ): string | null {
    const intersections = this.raycaster.intersectObjects(
      [...selectableObjects],
      true,
    );
    for (const intersection of intersections) {
      const postId = findPostIdFromObject(intersection.object);
      if (postId !== null) {
        return postId;
      }
    }

    return null;
  }
}

export function findPostIdFromObject(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    const postId: unknown = current.userData.postId;
    if (typeof postId === "string" && postId.length > 0) {
      return postId;
    }
    current = current.parent;
  }
  return null;
}
