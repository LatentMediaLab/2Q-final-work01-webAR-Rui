import { describe, expect, it } from "vitest";
import {
  readDisplayPostCount,
  selectPostsForDisplay,
  sortPostsOldestFirst,
} from "../src/app/readDisplayPostCount";

describe("readDisplayPostCount", () => {
  it.each([10, 20, 35, 40, 50] as const)(
    "accepts the supported count %i",
    (count) => {
      expect(readDisplayPostCount(`?count=${count}`)).toBe(count);
    },
  );

  it("uses 35 when the parameter is absent or unsupported", () => {
    expect(readDisplayPostCount("")).toBe(35);
    expect(readDisplayPostCount("?count=30")).toBe(35);
    expect(readDisplayPostCount("?count=invalid")).toBe(35);
  });

  it("selects only the requested number without changing the source", () => {
    const posts = Array.from({ length: 70 }, (_unused, index) => index);

    expect(selectPostsForDisplay(posts, 40)).toEqual(posts.slice(0, 40));
    expect(posts).toHaveLength(70);
  });

  it("returns every available post when fewer posts were saved", () => {
    const posts = Array.from({ length: 8 }, (_unused, index) => index);
    expect(selectPostsForDisplay(posts, 50)).toEqual(posts);
  });

  it("sorts dated posts oldest first without changing the source", () => {
    const posts = [
      { id: "new", postedAt: "2026-03-01T00:00:00.000Z" },
      { id: "old", postedAt: "2024-01-01T00:00:00.000Z" },
      { id: "middle", postedAt: "2025-02-01T00:00:00.000Z" },
    ];

    expect(sortPostsOldestFirst(posts).map(({ id }) => id)).toEqual([
      "old",
      "middle",
      "new",
    ]);
    expect(posts.map(({ id }) => id)).toEqual(["new", "old", "middle"]);
  });

  it("keeps missing or invalid dates at the end in source order", () => {
    const posts = [
      { id: "missing" },
      { id: "dated", postedAt: "2025-01-01T00:00:00.000Z" },
      { id: "invalid", postedAt: "not-a-date" },
    ];

    expect(sortPostsOldestFirst(posts).map(({ id }) => id)).toEqual([
      "dated",
      "missing",
      "invalid",
    ]);
  });
});
