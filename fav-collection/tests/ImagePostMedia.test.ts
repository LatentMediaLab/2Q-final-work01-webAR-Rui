import { describe, expect, it } from "vitest";
import type { PostRecord } from "../src/data/PostTypes";
import { APP_CONFIG } from "../src/app/config";
import {
  getFramedPostVerticalLayout,
  requirePostMedia,
} from "../src/scene/BaseFramedPostExhibit";

describe("image post media selection", () => {
  it("uses only the first image when a post contains multiple images", () => {
    const post: PostRecord = {
      id: "multiple-images",
      authorName: "作者",
      authorHandle: "@author",
      text: "複数画像の投稿",
      mediaType: "image",
      media: [
        { type: "image", src: "/images/first.jpg" },
        { type: "image", src: "/images/second.jpg" },
      ],
    };

    expect(requirePostMedia(post, "image").src).toBe("/images/first.jpg");
  });

  it("places a two-line body above the image within one frame", () => {
    const imageHeight = 0.4;
    const bodyHeight = 0.12;
    const layout = getFramedPostVerticalLayout(imageHeight, bodyHeight);
    const imageTop = layout.imageCenterY + imageHeight / 2;
    const bodyBottom = layout.bodyCenterY - bodyHeight / 2;

    expect(layout.framedContentHeight).toBe(imageHeight + bodyHeight);
    expect(layout.frameCenterY).toBe(APP_CONFIG.layout.captionHeight / 2);
    expect(bodyBottom).toBeCloseTo(imageTop);
    expect(layout.bodyCenterY).toBeGreaterThan(layout.imageCenterY);
    expect(layout.captionCenterY).toBeLessThan(layout.imageCenterY);
  });
});
