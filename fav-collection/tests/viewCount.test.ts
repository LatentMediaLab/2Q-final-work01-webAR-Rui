import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/app/config";
import {
  mapViewCountToScale,
  mapViewCountToTextSpeed,
  normalizeViewCount,
} from "../src/utils/viewCount";

describe("view count mapping", () => {
  it("normalizes view counts logarithmically and clamps the result", () => {
    expect(normalizeViewCount(0, 0, 999)).toBe(0);
    expect(normalizeViewCount(999, 0, 999)).toBe(1);
    expect(normalizeViewCount(9, 0, 999)).toBeCloseTo(1 / 3, 6);
    expect(normalizeViewCount(-10, 0, 999)).toBe(0);
    expect(normalizeViewCount(10_000, 0, 999)).toBe(1);
  });

  it("maps the minimum and maximum to the configured media scales", () => {
    expect(mapViewCountToScale(10, 10, 10_000)).toBe(APP_CONFIG.scale.min);
    expect(mapViewCountToScale(10_000, 10, 10_000)).toBe(
      APP_CONFIG.scale.max,
    );
  });

  it("maps views to the configured text speed range", () => {
    expect(mapViewCountToTextSpeed(10, 10, 10_000)).toBe(
      APP_CONFIG.textSpeed.min,
    );
    expect(mapViewCountToTextSpeed(10_000, 10, 10_000)).toBe(
      APP_CONFIG.textSpeed.max,
    );
  });

  it("uses a neutral midpoint when every view count is the same", () => {
    expect(normalizeViewCount(100, 100, 100)).toBe(0.5);
    expect(mapViewCountToScale(100, 100, 100)).toBeCloseTo(
      (APP_CONFIG.scale.min + APP_CONFIG.scale.max) / 2,
    );
  });
});
