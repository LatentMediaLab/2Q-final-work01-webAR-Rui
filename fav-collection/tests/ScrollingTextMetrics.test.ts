import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/app/config";
import {
  createScrollingTextLines,
  getScrollingTextMetrics,
  measureCharacterUnits,
} from "../src/scene/ScrollingTextMetrics";

describe("ScrollingTextMetrics", () => {
  it("expands the panel width from the longest line", () => {
    const shortWidth = getScrollingTextMetrics("@author", "短い文章").width;
    const longWidth = getScrollingTextMetrics(
      "@author",
      "長い日本語の文章です。".repeat(12),
    ).width;

    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  it("preserves every newline style as a separate line", () => {
    expect(
      createScrollingTextLines("@author", "一行目\r\n二行目\r三行目\n四行目"),
    ).toEqual(["@author　一行目", "二行目", "三行目", "四行目"]);
  });

  it("expands the panel height as line count increases", () => {
    const oneLine = getScrollingTextMetrics("@author", "一行目");
    const fourLines = getScrollingTextMetrics(
      "@author",
      "一行目\n二行目\n三行目\n四行目",
    );

    expect(fourLines.height).toBeGreaterThan(oneLine.height);
    expect(fourLines.width).toBe(oneLine.width);
  });

  it("counts full-width characters more heavily than ASCII", () => {
    expect(measureCharacterUnits("日本語")).toBeGreaterThan(
      measureCharacterUnits("abc"),
    );
  });

  it("keeps widths within the configured safe range", () => {
    expect(getScrollingTextMetrics("@a", "").width).toBe(
      APP_CONFIG.layout.textPanelMinWidth,
    );
    expect(getScrollingTextMetrics("@a", "長".repeat(1_000)).width).toBe(
      APP_CONFIG.layout.textPanelMaxWidth,
    );
  });

  it("keeps very high line counts within the configured safe height", () => {
    expect(
      getScrollingTextMetrics("@a", Array.from({ length: 100 }, () => "行").join("\n"))
        .height,
    ).toBe(APP_CONFIG.layout.textPanelMaxHeight);
  });
});
