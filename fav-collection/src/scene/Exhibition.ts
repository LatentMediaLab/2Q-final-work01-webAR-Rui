import * as THREE from "three";
import { APP_CONFIG } from "../app/config";
import type { PostRecord } from "../data/PostTypes";
import { createExhibitionLayout } from "./ExhibitionLayout";
import { ImagePostExhibit } from "./ImagePostExhibit";
import type { PostExhibit } from "./PostExhibit";
import { TextPostExhibit } from "./TextPostExhibit";
import { VideoPostExhibit } from "./VideoPostExhibit";
import { runWithConcurrency } from "../utils/runWithConcurrency";

export class Exhibition {
  public readonly group = new THREE.Group();

  private readonly objects: PostExhibit[] = [];
  private loadVersion = 0;
  private disposed = false;
  private textAnimationPaused = false;
  private captionsVisible = true;

  public constructor() {
    this.group.name = "exhibition";
  }

  public async load(posts: readonly PostRecord[]): Promise<void> {
    if (this.disposed) {
      return;
    }

    const version = this.loadVersion + 1;
    this.loadVersion = version;
    this.clearObjects();

    const displayPosts = limitExhibitionPosts(posts);
    const layouts = createExhibitionLayout(displayPosts);
    const postsById = new Map(displayPosts.map((post) => [post.id, post]));

    for (const layout of layouts) {
      const post = postsById.get(layout.postId);
      if (post === undefined) {
        continue;
      }

      const object = createPostExhibit(post, layout);
      object.setTextAnimationPaused(this.textAnimationPaused);
      object.setCaptionsVisible(this.captionsVisible);
      this.objects.push(object);
      this.group.add(object.group);
    }

    await runWithConcurrency(
      this.objects,
      APP_CONFIG.performance.preloadConcurrency,
      async (object) => object.load(),
    );

    if (this.disposed || version !== this.loadVersion) {
      return;
    }
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) {
      return;
    }
    this.objects.forEach((object) => object.update(deltaSeconds));
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public setTextAnimationPaused(paused: boolean): void {
    this.textAnimationPaused = paused;
    this.objects.forEach((object) => {
      object.setTextAnimationPaused(paused);
    });
  }

  public setCaptionsVisible(visible: boolean): void {
    this.captionsVisible = visible;
    this.objects.forEach((object) => {
      object.setCaptionsVisible(visible);
    });
  }

  public getSelectableObjects(): readonly THREE.Object3D[] {
    return this.objects.map((object) => object.group);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.loadVersion += 1;
    this.clearObjects();
  }

  private clearObjects(): void {
    this.objects.forEach((object) => object.dispose());
    this.objects.length = 0;
    this.group.clear();
  }
}

export function limitExhibitionPosts(
  posts: readonly PostRecord[],
): readonly PostRecord[] {
  if (posts.length <= APP_CONFIG.performance.maxPosts) {
    return posts;
  }
  console.warn(
    `[Fav Collection] 投稿数が上限${APP_CONFIG.performance.maxPosts}件を超えたため、先頭${APP_CONFIG.performance.maxPosts}件を表示します。`,
  );
  return posts.slice(0, APP_CONFIG.performance.maxPosts);
}

function createPostExhibit(
  post: PostRecord,
  layout: ReturnType<typeof createExhibitionLayout>[number],
): PostExhibit {
  switch (post.mediaType) {
    case "image":
      return new ImagePostExhibit(post, layout);
    case "video":
      return new VideoPostExhibit(post, layout);
    case "text":
      return new TextPostExhibit(post, layout);
  }
}
