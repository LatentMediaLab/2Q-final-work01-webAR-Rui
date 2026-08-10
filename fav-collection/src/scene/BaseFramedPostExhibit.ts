import * as THREE from "three";
import { APP_CONFIG } from "../app/config";
import type { PostMedia, PostRecord } from "../data/PostTypes";
import {
  createCaptionTexture,
  createFallbackTexture,
} from "./CanvasTextureFactory";
import type { ExhibitionLayoutItem } from "./ExhibitionLayout";
import {
  createFrame,
  createMountingSupport,
  selectFrameVariant,
} from "./FrameFactory";
import type { PostExhibit } from "./PostExhibit";
import { disposeObject3D } from "./disposeObject3D";
import { getOversizedMediaWarning } from "./mediaPerformance";
import { sharedPostTextureRepository } from "./SharedPostTextureRepository";

export abstract class BaseFramedPostExhibit implements PostExhibit {
  public readonly group = new THREE.Group();

  protected readonly contentCenterY = APP_CONFIG.layout.captionHeight / 2;
  private readonly imageMaterial: THREE.MeshBasicMaterial;
  private readonly caption: THREE.Mesh;
  private disposed = false;

  protected constructor(
    protected readonly post: PostRecord,
    protected readonly layout: ExhibitionLayoutItem,
    protected readonly media: PostMedia,
    fallbackLabel: string,
  ) {
    this.group.name = `${post.mediaType}-post-${post.id}`;
    this.group.userData.postId = post.id;
    this.group.position.set(layout.x, layout.y, layout.z);
    this.group.rotation.set(
      layout.rotationX,
      layout.rotationY,
      layout.rotationZ,
    );
    const sizeWarning = getOversizedMediaWarning(media);
    if (sizeWarning !== null) {
      console.warn(`[Fav Collection] 大きな画像素材 (id: ${post.id}): ${sizeWarning}`);
    }

    const frameVariant = selectFrameVariant(post.id, post.displaySeed);
    const support = createMountingSupport(
      layout.contentWidth,
      layout.contentHeight,
      layout.mountDepth,
      frameVariant,
    );
    support.position.y = this.contentCenterY;
    this.group.add(support);

    const fallbackTexture = createFallbackTexture(fallbackLabel);
    this.imageMaterial = new THREE.MeshBasicMaterial({
      map: fallbackTexture,
      toneMapped: false,
    });
    const image = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.contentWidth, layout.contentHeight),
      this.imageMaterial,
    );
    image.name = `${post.mediaType}-surface`;
    image.position.y = this.contentCenterY;
    this.group.add(image);

    const frame = createFrame(
      layout.contentWidth,
      layout.contentHeight,
      frameVariant,
    );
    frame.position.y = this.contentCenterY;
    this.group.add(frame);

    const captionTexture = createCaptionTexture(post.authorHandle, post.viewCount);
    this.caption = new THREE.Mesh(
      new THREE.PlaneGeometry(
        layout.contentWidth,
        APP_CONFIG.layout.captionHeight * 0.72,
      ),
      new THREE.MeshBasicMaterial({
        map: captionTexture,
        transparent: true,
        toneMapped: false,
      }),
    );
    this.caption.name = "post-caption";
    this.caption.position.set(
      0,
      -layout.contentHeight / 2 - APP_CONFIG.layout.captionHeight * 0.12,
      0.01,
    );
    this.group.add(this.caption);
  }

  public async load(): Promise<void> {
    const source = this.getTextureSource();
    if (source.length === 0) {
      this.warnLoadFailure("サムネイルが指定されていません。");
      return;
    }

    try {
      const texture = await sharedPostTextureRepository.load(source);

      if (this.disposed) {
        return;
      }

      const previousTexture = this.imageMaterial.map;
      if (previousTexture?.userData.sharedResource !== true) {
        previousTexture?.dispose();
      }
      this.imageMaterial.map = texture;
      this.imageMaterial.needsUpdate = true;
    } catch (error: unknown) {
      this.warnLoadFailure(error);
    }
  }

  public update(): void {}

  public setTextAnimationPaused(): void {}

  public setCaptionsVisible(visible: boolean): void {
    this.caption.visible = visible;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    disposeObject3D(this.group);
    this.group.clear();
  }

  protected abstract getTextureSource(): string;

  private warnLoadFailure(error: unknown): void {
    console.warn(
      `[Fav Collection] ${this.post.mediaType}素材を読み込めなかったため、代替表示を使用します。 (id: ${this.post.id})`,
      error,
    );
  }
}

export function requirePostMedia(
  post: PostRecord,
  type: PostMedia["type"],
): PostMedia {
  const media = post.media.find((item) => item.type === type);
  if (media === undefined) {
    throw new Error(`投稿 ${post.id} に ${type} 素材がありません。`);
  }
  return media;
}
