import { describe, expect, it, vi } from "vitest";
import type { PostRecord } from "../src/data/PostTypes";
import { limitExhibitionPosts } from "../src/scene/Exhibition";
import { createExhibitionLayout } from "../src/scene/ExhibitionLayout";

describe("exhibition post-count stability", () => {
  it.each([0, 1, 30, 50, 90])("creates a layout for %i posts", (count) => {
    const posts = createPosts(count);
    expect(createExhibitionLayout(posts)).toHaveLength(count);
  });

  it("limits inputs beyond the supported 90 posts", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(limitExhibitionPosts(createPosts(100))).toHaveLength(90);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});

function createPosts(count: number): PostRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `performance-${index}`,
    authorName: "性能テスト",
    authorHandle: "@performance",
    text: `投稿 ${index}`,
    mediaType: index % 7 === 0 ? "text" : "image",
    media:
      index % 7 === 0
        ? []
        : [
            {
              type: "image" as const,
              src: `/performance-${index}.png`,
              width: 800,
              height: 600,
            },
          ],
    ...(index % 5 === 0 ? {} : { viewCount: index * 100 }),
  }));
}
