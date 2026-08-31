import * as THREE from "three";
import { resolveWallPlacement } from "./placement";

export class Reticle {
  public readonly group = new THREE.Group();

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  public constructor() {
    this.group.name = "ar-placement-reticle";
    this.group.visible = false;

    const ringGeometry = new THREE.RingGeometry(0.055, 0.072, 40);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00213b,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.renderOrder = 100;
    this.geometries.push(ringGeometry);
    this.materials.push(ringMaterial);
    this.group.add(ring);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.095, 0, 0.001),
      new THREE.Vector3(-0.042, 0, 0.001),
      new THREE.Vector3(0.042, 0, 0.001),
      new THREE.Vector3(0.095, 0, 0.001),
      new THREE.Vector3(0, -0.095, 0.001),
      new THREE.Vector3(0, -0.042, 0.001),
      new THREE.Vector3(0, 0.042, 0.001),
      new THREE.Vector3(0, 0.095, 0.001),
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xe6e5ef,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const guides = new THREE.LineSegments(lineGeometry, lineMaterial);
    guides.renderOrder = 101;
    this.geometries.push(lineGeometry);
    this.materials.push(lineMaterial);
    this.group.add(guides);
  }

  public update(pose: XRPose | null, viewerPosition: THREE.Vector3): void {
    if (pose === null) {
      this.group.visible = false;
      return;
    }

    const transform = resolveWallPlacement(
      pose.transform.matrix,
      viewerPosition,
      0,
    );
    this.group.position.copy(transform.position);
    this.group.quaternion.copy(transform.quaternion);
    this.group.visible = true;
  }

  public hide(): void {
    this.group.visible = false;
  }

  public dispose(): void {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.group.clear();
  }
}
