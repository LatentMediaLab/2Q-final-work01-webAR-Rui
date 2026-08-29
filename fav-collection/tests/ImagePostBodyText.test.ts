import { describe, expect, it } from "vitest";
import {
  createImagePostBodyLines,
  hasImagePostBody,
  IMAGE_POST_BODY_MAX_LINES,
} from "../src/scene/ImagePostBodyText";

describe("ImagePostBodyText", () => {
  it("omits the body panel for an empty image post", () => {
    expect(hasImagePostBody("  \n ")).toBe(false);
    expect(createImagePostBodyLines("  \n ")).toEqual([]);
  });

  it("keeps short body text without an ellipsis", () => {
    expect(createImagePostBodyLines("画像投稿の短い本文です。")).toEqual([
      "画像投稿の短い本文です。",
    ]);
  });

  it("limits long body text to two lines and adds an ellipsis", () => {
    const lines = createImagePostBodyLines("長い画像投稿の本文です。".repeat(30));

    expect(lines).toHaveLength(IMAGE_POST_BODY_MAX_LINES);
    expect(lines.at(-1)).toMatch(/…$/u);
  });

  it("preserves explicit line breaks within the two-line limit", () => {
    expect(createImagePostBodyLines("一行目\n二行目")).toEqual([
      "一行目",
      "二行目",
    ]);
  });

  it("shortens additional explicit lines", () => {
    expect(createImagePostBodyLines("一行目\n二行目\n三行目")).toEqual([
      "一行目",
      "二行目…",
    ]);
  });
});
