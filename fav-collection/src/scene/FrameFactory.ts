import * as THREE from "three";
import { hashStringToSeed } from "../utils/seededRandom";

export type FrameVariant = "brass" | "wood" | "floating";

const FRAME_VARIANTS: readonly FrameVariant[] = ["brass", "wood", "floating"];
const sharedMaterials = new Map<string, THREE.MeshStandardMaterial>();

export function selectFrameVariant(
  postId: string,
  displaySeed?: number,
): FrameVariant {
  const seed = displaySeed ?? hashStringToSeed(postId);
  return FRAME_VARIANTS[Math.abs(Math.trunc(seed)) % FRAME_VARIANTS.length] ?? "brass";
}

export function createFrame(
  width: number,
  height: number,
  variant: FrameVariant,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `frame-${variant}`;

  switch (variant) {
    case "brass":
      addBars(group, width, height, 0.01, 0xc4a65a, 0.012, 0.28, 0.72);
      addBars(
        group,
        width + 0.022,
        height + 0.022,
        0.004,
        0x6f5a2c,
        0.009,
        0.42,
        0.58,
      );
      break;
    case "wood":
      addBars(group, width, height, 0.017, 0x5d3423, 0.016, 0.9, 0.02);
      addBars(
        group,
        width - 0.012,
        height - 0.012,
        0.004,
        0xc09a62,
        0.019,
        0.72,
        0.04,
      );
      break;
    case "floating": {
      const backing = new THREE.Mesh(
        new THREE.PlaneGeometry(width + 0.028, height + 0.028),
        getSharedMaterial("floating-backing", {
          color: 0xe8dfca,
          roughness: 0.45,
          metalness: 0.08,
          transparent: true,
          opacity: 0.66,
        }),
      );
      backing.position.z = -0.012;
      group.add(backing);
      addBars(
        group,
        width + 0.014,
        height + 0.014,
        0.0035,
        0x384449,
        0.01,
        0.34,
        0.48,
      );
      break;
    }
  }

  return group;
}

export function createMountingSupport(
  width: number,
  height: number,
  depth: number,
  variant: FrameVariant,
): THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> {
  const appearances: Record<
    FrameVariant,
    { readonly color: number; readonly roughness: number; readonly metalness: number }
  > = {
    brass: { color: 0x5b4930, roughness: 0.52, metalness: 0.42 },
    wood: { color: 0x362219, roughness: 0.92, metalness: 0.01 },
    floating: { color: 0xb9c4c4, roughness: 0.4, metalness: 0.24 },
  };
  const appearance = appearances[variant];
  const support = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.018, height + 0.018, depth),
    getSharedMaterial(`support-${variant}`, appearance),
  );
  support.name = `mounting-support-${variant}`;
  support.position.z = -depth / 2 - 0.003;
  return support;
}

function addBars(
  group: THREE.Group,
  width: number,
  height: number,
  thickness: number,
  color: number,
  z: number,
  roughness: number,
  metalness: number,
): void {
  const material = getSharedMaterial(
    `bar-${color}-${roughness}-${metalness}`,
    { color, roughness, metalness },
  );
  const horizontalGeometry = new THREE.BoxGeometry(
    width + thickness * 2,
    thickness,
    0.016,
  );
  const verticalGeometry = new THREE.BoxGeometry(thickness, height, 0.016);

  for (const y of [-height / 2 - thickness / 2, height / 2 + thickness / 2]) {
    const bar = new THREE.Mesh(horizontalGeometry, material);
    bar.position.set(0, y, z);
    group.add(bar);
  }
  for (const x of [-width / 2 - thickness / 2, width / 2 + thickness / 2]) {
    const bar = new THREE.Mesh(verticalGeometry, material);
    bar.position.set(x, 0, z);
    group.add(bar);
  }
}

export function disposeSharedFrameMaterials(): void {
  sharedMaterials.forEach((material) => material.dispose());
  sharedMaterials.clear();
}

function getSharedMaterial(
  key: string,
  parameters: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  const existing = sharedMaterials.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const material = new THREE.MeshStandardMaterial(parameters);
  material.userData.sharedResource = true;
  sharedMaterials.set(key, material);
  return material;
}
