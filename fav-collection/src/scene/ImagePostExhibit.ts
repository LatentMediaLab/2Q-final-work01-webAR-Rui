import type { PostRecord } from "../data/PostTypes";
import { BaseFramedPostExhibit, requirePostMedia } from "./BaseFramedPostExhibit";
import type { ExhibitionLayoutItem } from "./ExhibitionLayout";

export class ImagePostExhibit extends BaseFramedPostExhibit {
  public constructor(post: PostRecord, layout: ExhibitionLayoutItem) {
    super(post, layout, requirePostMedia(post, "image"), "IMAGE");
  }

  protected getTextureSource(): string {
    return this.media.src;
  }
}
