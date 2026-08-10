import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/app/config";
import {
  getRendererPixelRatio,
  shouldUseAntialias,
} from "../src/scene/rendererPerformance";

describe("rendererPerformance", () => {
  it("caps high-density displays to the configured pixel ratio", () => {
    expect(getRendererPixelRatio(3)).toBe(APP_CONFIG.performance.maxPixelRatio);
    expect(getRendererPixelRatio(1)).toBe(1);
  });

  it("disables extra antialiasing on high-density displays", () => {
    expect(shouldUseAntialias(1)).toBe(true);
    expect(shouldUseAntialias(3)).toBe(false);
  });
});
