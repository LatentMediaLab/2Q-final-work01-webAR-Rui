import * as THREE from "three";
import type { PostRecord } from "../data/PostTypes";
import { createTextPostTexture } from "./CanvasTextureFactory";
import type { ExhibitionLayoutItem } from "./ExhibitionLayout";
import type { PostExhibit } from "./PostExhibit";
import { disposeObject3D } from "./disposeObject3D";
import { createSeededRandom, hashStringToSeed } from "../utils/seededRandom";

export class TextPostExhibit implements PostExhibit {
  public readonly group = new THREE.Group();

  private disposed = false;

  public constructor(
    post: PostRecord,
    layout: ExhibitionLayoutItem,
  ) {
    this.group.name = `text-post-${post.id}`;
    this.group.userData.postId = post.id;
    this.group.position.set(layout.x, layout.y, layout.z);
    this.group.rotation.set(
      layout.rotationX,
      layout.rotationY,
      layout.rotationZ,
    );

    const random = createSeededRandom(hashStringToSeed(post.id) ^ 0x27d4eb2d);
    const supportPalette = [0xddd4c3, 0xb9c1bc, 0xc9b9a9] as const;
    const supportColor =
      supportPalette[Math.floor(random() * supportPalette.length)] ??
      supportPalette[0];
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(
        layout.contentWidth + 0.012,
        layout.contentHeight + 0.012,
        layout.mountDepth,
      ),
      new THREE.MeshStandardMaterial({
        color: supportColor,
        transparent: true,
        opacity: 0.38,
        roughness: 0.76,
        metalness: 0.03,
      }),
    );
    support.name = "text-support";
    support.position.z = -layout.mountDepth / 2 - 0.003;
    this.group.add(support);

    const texture = createTextPostTexture(post.authorName, post.text);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.contentWidth, layout.contentHeight),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        toneMapped: false,
        depthWrite: false,
        depthTest: true,
      }),
    );
    panel.name = "text-post-surface";
    panel.position.z = 0.002;
    this.group.add(panel);
  }

  public async load(): Promise<void> {
    await Promise.resolve();
  }

  public setCaptionsVisible(): void {}

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    disposeObject3D(this.group);
    this.group.clear();
  }
}
