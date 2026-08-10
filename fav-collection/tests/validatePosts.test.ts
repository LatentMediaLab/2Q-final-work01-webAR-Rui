import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/app/config";
import { validatePosts } from "../src/data/validatePosts";

function createValidImagePost(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "post-1",
    authorName: "作者",
    authorHandle: "@author",
    text: "本文",
    mediaType: "image",
    media: [
      {
        type: "image",
        src: "/assets/posts/image-placeholder.svg",
      },
    ],
    viewCount: 100,
    likeCount: 10,
    repostCount: 2,
    ...overrides,
  };
}

describe("validatePosts", () => {
  it("validates a normal post", () => {
    const result = validatePosts([createValidImagePost()]);

    expect(result.issues).toEqual([]);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject({
      id: "post-1",
      mediaType: "image",
      viewCount: 100,
      likeCount: 10,
    });
  });

  it("excludes invalid posts while preserving valid posts", () => {
    const result = validatePosts([
      createValidImagePost(),
      createValidImagePost({ id: "", authorHandle: 42 }),
    ]);

    expect(result.posts.map((post) => post.id)).toEqual(["post-1"]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe("invalid-record");
  });

  it("excludes duplicate IDs and reports them", () => {
    const result = validatePosts([
      createValidImagePost(),
      createValidImagePost({ text: "重複した投稿" }),
    ]);

    expect(result.posts).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe("duplicate-id");
    expect(result.issues[0]?.id).toBe("post-1");
  });

  it("clamps negative counts to zero", () => {
    const result = validatePosts([
      createValidImagePost({
        viewCount: -100,
        likeCount: -5,
        repostCount: -2,
      }),
    ]);

    expect(result.posts[0]).toMatchObject({
      viewCount: 0,
      likeCount: 0,
      repostCount: 0,
    });
  });

  it("fills a missing view count with the median and other defaults", () => {
    const result = validatePosts([
      createValidImagePost({ id: "post-a", viewCount: 10 }),
      createValidImagePost({
        id: "post-b",
        viewCount: undefined,
        likeCount: undefined,
        authorIconSrc: undefined,
      }),
      createValidImagePost({ id: "post-c", viewCount: 30 }),
    ]);

    expect(result.posts[1]).toMatchObject({
      id: "post-b",
      viewCount: 20,
      likeCount: 0,
      authorIconSrc: APP_CONFIG.data.defaultAuthorIconSrc,
    });
  });

  it("accepts an empty array", () => {
    expect(validatePosts([])).toEqual({ posts: [], issues: [] });
  });
});
