import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/app/config";
import {
  createTextPostLines,
  getTextPostMetrics,
  measureCharacterUnits,
  TEXT_POST_CHARACTERS_PER_LINE,
} from "../src/scene/ScrollingTextMetrics";

describe("TextPostMetrics", () => {
  it("expands the panel width from the longest line", () => {
    const shortWidth = getTextPostMetrics("作者", "短い文章").width;
    const longWidth = getTextPostMetrics(
      "作者",
      "長い日本語の文章です。".repeat(12),
    ).width;

    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  it("places the account name on its own first line", () => {
    expect(
      createTextPostLines("表示名", "一行目\r\n二行目\r三行目\n四行目"),
    ).toEqual(["表示名", "一行目", "二行目", "三行目", "四行目"]);
  });

  it("wraps body text after every 40 characters", () => {
    expect(createTextPostLines("表示名", "あ".repeat(41))).toEqual([
      "表示名",
      "あ".repeat(TEXT_POST_CHARACTERS_PER_LINE),
      "あ",
    ]);
  });

  it("expands the panel height as line count increases", () => {
    const oneLine = getTextPostMetrics("作者", "一行目");
    const fourLines = getTextPostMetrics(
      "作者",
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
    expect(getTextPostMetrics("A", "").width).toBe(
      APP_CONFIG.layout.textPanelMinWidth,
    );
    expect(getTextPostMetrics("A", "長".repeat(1_000)).width).toBeLessThanOrEqual(
      APP_CONFIG.layout.textPanelMaxWidth,
    );
  });

  it("does not cap the number of displayed body lines", () => {
    const body = Array.from({ length: 100 }, () => "行").join("\n");
    const metrics = getTextPostMetrics("作者", body);

    expect(metrics.lines).toHaveLength(101);
    expect(metrics.height).toBe(
      metrics.lines.length * APP_CONFIG.layout.textLineHeight +
        APP_CONFIG.layout.textVerticalPadding,
    );
  });
});
