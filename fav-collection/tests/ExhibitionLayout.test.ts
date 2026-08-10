import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/app/config";
import type { PostRecord } from "../src/data/PostTypes";
import {
  createExhibitionLayout,
  isRectangleInsideExhibition,
  rectanglesOverlap,
} from "../src/scene/ExhibitionLayout";

function createPost(
  id: string,
  mediaType: PostRecord["mediaType"],
  viewCount: number,
  width = 800,
  height = 600,
): PostRecord {
  return {
    id,
    authorName: "テスト作者",
    authorHandle: "@test",
    text: `レイアウトテスト ${id}`,
    mediaType,
    media:
      mediaType === "text"
        ? []
        : [
            {
              type: mediaType,
              src: `/test/${id}.svg`,
              width,
              height,
            },
          ],
    viewCount,
  };
}

describe("ExhibitionLayout", () => {
  it("detects overlapping and separated rectangles", () => {
    const first = { x: 0, y: 0, width: 1, height: 1 };
    expect(
      rectanglesOverlap(first, { x: 0.4, y: 0, width: 1, height: 1 }),
    ).toBe(true);
    expect(
      rectanglesOverlap(first, { x: 1, y: 0, width: 1, height: 1 }),
    ).toBe(false);
  });

  it("produces the same layout for the same posts", () => {
    const posts = createPosts();
    expect(createExhibitionLayout(posts)).toEqual(createExhibitionLayout(posts));
  });

  it("keeps every initial layout rectangle inside the exhibition", () => {
    const layout = createExhibitionLayout(createPosts());
    expect(layout).toHaveLength(createPosts().length);
    layout.forEach((item) => {
      expect(isRectangleInsideExhibition(item)).toBe(true);
    });
  });

  it("places media rectangles without collisions", () => {
    const mediaLayouts = createExhibitionLayout(createPosts()).filter(
      (item) => item.mediaType !== "text",
    );

    mediaLayouts.forEach((item, index) => {
      mediaLayouts.slice(index + 1).forEach((other) => {
        expect(rectanglesOverlap(item, other)).toBe(false);
      });
    });
  });

  it("places text lanes above and below the exhibition center", () => {
    const textLayouts = createExhibitionLayout(createPosts()).filter(
      (item) => item.mediaType === "text",
    );

    expect(textLayouts.some((item) => item.y > 0)).toBe(true);
    expect(textLayouts.some((item) => item.y < 0)).toBe(true);
    textLayouts.forEach((item) => {
      expect(Math.abs(item.y)).toBeGreaterThanOrEqual(item.height / 2);
    });
  });

  it("keeps media placement independent from text lanes", () => {
    const posts = createPosts();
    const mediaPosts = posts.filter((post) => post.mediaType !== "text");
    const mixedMediaLayout = createExhibitionLayout(posts).filter(
      (item) => item.mediaType !== "text",
    );
    const mediaOnlyLayout = createExhibitionLayout(mediaPosts);

    expect(mixedMediaLayout).toEqual(mediaOnlyLayout);
  });

  it("places text surfaces behind every image and video exhibit", () => {
    const layout = createExhibitionLayout(createPosts());
    const textLayouts = layout.filter((item) => item.mediaType === "text");
    const mediaLayouts = layout.filter((item) => item.mediaType !== "text");
    const nearestTextDepth = Math.max(...textLayouts.map((item) => item.z));
    const furthestMediaDepth = Math.min(...mediaLayouts.map((item) => item.z));

    expect(nearestTextDepth).toBeLessThan(furthestMediaDepth);
  });

  it("handles posts whose view counts are all equal", () => {
    const posts = Array.from({ length: 10 }, (_unused, index) =>
      createPost(`equal-${index}`, "image", 500),
    );
    const layout = createExhibitionLayout(posts);

    expect(layout).toHaveLength(posts.length);
    layout.forEach((item) => {
      expect(item.normalizedViewCount).toBe(0.5);
      expect(Number.isFinite(item.x)).toBe(true);
      expect(Number.isFinite(item.y)).toBe(true);
      expect(isRectangleInsideExhibition(item)).toBe(true);
    });
  });

  it("adds deterministic size variation among equal-view media posts", () => {
    const posts = Array.from({ length: 12 }, (_unused, index) =>
      createPost(`variation-${index}`, "image", 1_000, 1_000, 1_000),
    );
    const widths = createExhibitionLayout(posts).map((item) =>
      item.contentWidth.toFixed(4),
    );

    expect(new Set(widths).size).toBeGreaterThan(4);
  });

  it("adds deterministic three-dimensional poses within safe bounds", () => {
    const layout = createExhibitionLayout(createPosts());

    layout.forEach((item) => {
      expect(item.z).toBeGreaterThanOrEqual(APP_CONFIG.exhibition.wallOffset);
      expect(item.z).toBeLessThanOrEqual(
        APP_CONFIG.exhibition.wallOffset +
          APP_CONFIG.exhibition.maxDepthOffset,
      );
      expect(item.mountDepth).toBeGreaterThan(0);
      expect(Number.isFinite(item.rotationX)).toBe(true);
      expect(Number.isFinite(item.rotationY)).toBe(true);
      expect(Number.isFinite(item.rotationZ)).toBe(true);
    });
  });

  it("varies depth and tilt among equal-view exhibits", () => {
    const posts = Array.from({ length: 12 }, (_unused, index) =>
      createPost(`pose-${index}`, "image", 1_000),
    );
    const layout = createExhibitionLayout(posts);

    expect(new Set(layout.map((item) => item.z.toFixed(4))).size).toBeGreaterThan(
      4,
    );
    expect(
      new Set(layout.map((item) => item.rotationY.toFixed(4))).size,
    ).toBeGreaterThan(4);
  });

  it("assigns available text posts to separate lanes before reusing a lane", () => {
    const posts = Array.from({ length: 5 }, (_unused, index) =>
      createPost(`lane-${index}`, "text", 100),
    );
    const laneIndexes = createExhibitionLayout(posts).map(
      (item) => item.laneIndex,
    );

    expect(new Set(laneIndexes).size).toBe(5);
  });

  it("sizes scrolling text panels from their longest line", () => {
    const shortPost = createPost("short-text", "text", 100);
    const longPost = {
      ...createPost("long-text", "text", 100),
      text: "長文の日本語が一行に長く続く場合は表示幅が広がります。".repeat(5),
    };
    const layout = createExhibitionLayout([shortPost, longPost]);
    const shortLayout = layout.find((item) => item.postId === shortPost.id);
    const longLayout = layout.find((item) => item.postId === longPost.id);

    expect(shortLayout).toBeDefined();
    expect(longLayout).toBeDefined();
    expect(longLayout?.contentWidth).toBeGreaterThan(
      shortLayout?.contentWidth ?? Number.POSITIVE_INFINITY,
    );
  });

  it("uses taller text panels for posts with more line breaks", () => {
    const oneLinePost = createPost("one-line", "text", 100);
    const multiLinePost = {
      ...createPost("multi-line", "text", 100),
      text: "一行目\n二行目\n三行目\n四行目\n五行目",
    };
    const layout = createExhibitionLayout([oneLinePost, multiLinePost]);
    const oneLineLayout = layout.find(
      (item) => item.postId === oneLinePost.id,
    );
    const multiLineLayout = layout.find(
      (item) => item.postId === multiLinePost.id,
    );

    expect(multiLineLayout?.contentHeight).toBeGreaterThan(
      oneLineLayout?.contentHeight ?? Number.POSITIVE_INFINITY,
    );
  });

  it("keeps variable-height text lanes vertically separated", () => {
    const posts = [
      { ...createPost("two-lines", "text", 100), text: "一行目\n二行目" },
      {
        ...createPost("six-lines", "text", 100),
        text: "一\n二\n三\n四\n五\n六",
      },
      createPost("single-line", "text", 100),
    ];
    const layout = createExhibitionLayout(posts);

    layout.forEach((item, index) => {
      layout.slice(index + 1).forEach((other) => {
        expect(rectanglesOverlap(item, other)).toBe(false);
      });
    });
  });
});

function createPosts(): PostRecord[] {
  const mediaPosts = Array.from({ length: 24 }, (_unused, index) =>
    createPost(
      `media-${index}`,
      index % 5 === 0 ? "video" : "image",
      10 ** (index % 7),
      index % 3 === 0 ? 1_600 : 800,
      index % 4 === 0 ? 900 : 1_000,
    ),
  );
  const textPosts = Array.from({ length: 5 }, (_unused, index) =>
    createPost(`text-${index}`, "text", 100 * (index + 1)),
  );
  return [...mediaPosts, ...textPosts];
}
