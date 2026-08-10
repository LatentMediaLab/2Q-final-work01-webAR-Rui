import { describe, expect, it } from "vitest";
import {
  clampFallbackTransform,
  createGestureMetrics,
  DEFAULT_FALLBACK_TRANSFORM,
  transformFromGesture,
} from "../src/ar/FallbackTransform";

describe("fallback manual transform", () => {
  it("moves the exhibition with one pointer", () => {
    const start = createGestureMetrics([{ x: 100, y: 100 }]);
    const current = createGestureMetrics([{ x: 200, y: 250 }]);
    expect(start).not.toBeNull();
    expect(current).not.toBeNull();
    if (start === null || current === null) {
      return;
    }

    const result = transformFromGesture(
      DEFAULT_FALLBACK_TRANSFORM,
      start,
      current,
      1_000,
      1_000,
    );

    expect(result.x).toBeCloseTo(0.4);
    expect(result.y).toBeCloseTo(-0.6);
    expect(result.scale).toBe(DEFAULT_FALLBACK_TRANSFORM.scale);
  });

  it("scales and follows a clockwise two-pointer rotation", () => {
    const start = createGestureMetrics([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    const current = createGestureMetrics([
      { x: 150, y: 50 },
      { x: 150, y: 250 },
    ]);
    expect(start).not.toBeNull();
    expect(current).not.toBeNull();
    if (start === null || current === null) {
      return;
    }

    const result = transformFromGesture(
      DEFAULT_FALLBACK_TRANSFORM,
      start,
      current,
      1_000,
      1_000,
    );

    expect(result.scale).toBeCloseTo(DEFAULT_FALLBACK_TRANSFORM.scale * 2);
    expect(result.rotation).toBeCloseTo(-Math.PI / 2);
  });

  it("follows a counterclockwise two-pointer rotation", () => {
    const start = createGestureMetrics([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    const current = createGestureMetrics([
      { x: 150, y: 150 },
      { x: 150, y: 50 },
    ]);
    expect(start).not.toBeNull();
    expect(current).not.toBeNull();
    if (start === null || current === null) {
      return;
    }

    const result = transformFromGesture(
      DEFAULT_FALLBACK_TRANSFORM,
      start,
      current,
      1_000,
      1_000,
    );

    expect(result.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("clamps scale and position to safe limits", () => {
    const result = clampFallbackTransform({
      x: 100,
      y: -100,
      scale: 100,
      rotation: Math.PI * 4,
    });

    expect(result.x).toBe(4);
    expect(result.y).toBe(-3);
    expect(result.scale).toBe(2.2);
    expect(result.rotation).toBeCloseTo(0);
  });

  it("returns null when a gesture has no points", () => {
    expect(createGestureMetrics([])).toBeNull();
  });
});
