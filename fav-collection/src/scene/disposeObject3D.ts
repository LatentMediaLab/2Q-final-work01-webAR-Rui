import * as THREE from "three";

export function disposeObject3D(object: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  object.traverse((child) => {
    if (
      !(child instanceof THREE.Mesh) &&
      !(child instanceof THREE.Line) &&
      !(child instanceof THREE.Points)
    ) {
      return;
    }

    if (!disposedGeometries.has(child.geometry)) {
      child.geometry.dispose();
      disposedGeometries.add(child.geometry);
    }

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      if (material.userData.sharedResource === true) {
        return;
      }
      Object.values(material).forEach((value) => {
        if (
          value instanceof THREE.Texture &&
          value.userData.sharedResource !== true &&
          !disposedTextures.has(value)
        ) {
          value.dispose();
          disposedTextures.add(value);
        }
      });

      if (!disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
      }
    });
  });
}
