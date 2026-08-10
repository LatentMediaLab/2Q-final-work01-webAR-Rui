import { describe, expect, it } from "vitest";
import type { PostRecord } from "../src/data/PostTypes";
import {
  formatPostDate,
  formatPostDetail,
} from "../src/ui/PostDetailModel";

const basePost: PostRecord = {
  id: "detail-001",
  authorName: "展示作者",
  authorHandle: "@detail_author",
  text: "詳細表示のテスト本文です。",
  mediaType: "image",
  media: [
    {
      type: "image",
      src: "/image.svg",
      alt: "詳細画像",
    },
  ],
  viewCount: 12_345,
  likeCount: 67,
};

describe("PostDetailModel", () => {
  it("formats display values and media information", () => {
    const detail = formatPostDetail({
      ...basePost,
      postUrl: "https://example.com/post/1",
      postedAt: "2026-07-01T10:20:00+09:00",
    });

    expect(detail.viewCount).toBe("12,345");
    expect(detail.likeCount).toBe("67");
    expect(detail.media).toEqual({
      type: "image",
      src: "/image.svg",
      alt: "詳細画像",
    });
    expect(detail.postUrl).toBe("https://example.com/post/1");
    expect(detail.postedAt).toBeDefined();
  });

  it("omits missing dates, links, and empty text", () => {
    const detail = formatPostDetail({
      ...basePost,
      text: "   ",
      postedAt: undefined,
      likedAt: "invalid-date",
      postUrl: undefined,
    });

    expect(detail.text).toBeUndefined();
    expect(detail.postedAt).toBeUndefined();
    expect(detail.likedAt).toBeUndefined();
    expect(detail.postUrl).toBeUndefined();
  });

  it("returns undefined for missing or invalid dates", () => {
    expect(formatPostDate(undefined)).toBeUndefined();
    expect(formatPostDate("not-a-date")).toBeUndefined();
  });
});
