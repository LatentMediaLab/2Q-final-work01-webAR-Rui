import * as THREE from "three";
import type { PostRecord } from "../data/PostTypes";
import { BaseFramedPostExhibit, requirePostMedia } from "./BaseFramedPostExhibit";
import type { ExhibitionLayoutItem } from "./ExhibitionLayout";

export class VideoPostExhibit extends BaseFramedPostExhibit {
  public constructor(post: PostRecord, layout: ExhibitionLayoutItem) {
    super(post, layout, requirePostMedia(post, "video"), "VIDEO");
    this.addPlayIndicator();
  }

  protected getTextureSource(): string {
    return this.media.thumbnailSrc ?? "";
  }

  private addPlayIndicator(): void {
    const radius = Math.min(
      this.layout.contentWidth,
      this.layout.contentHeight,
    ) * 0.13;
    const circle = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      }),
    );
    circle.name = "video-play-indicator-background";
    circle.position.set(0, this.contentCenterY, 0.025);
    this.group.add(circle);

    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(-radius * 0.28, -radius * 0.46);
    triangleShape.lineTo(radius * 0.56, 0);
    triangleShape.lineTo(-radius * 0.28, radius * 0.46);
    triangleShape.closePath();
    const triangle = new THREE.Mesh(
      new THREE.ShapeGeometry(triangleShape),
      new THREE.MeshBasicMaterial({
        color: 0xf7f0df,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    triangle.name = "video-play-indicator";
    triangle.position.set(radius * 0.05, this.contentCenterY, 0.03);
    this.group.add(triangle);
  }
}
