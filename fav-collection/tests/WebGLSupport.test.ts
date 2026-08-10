import { describe, expect, it } from "vitest";
import { isWebGLAvailable } from "../src/scene/WebGLSupport";

describe("WebGL support", () => {
  it("reports available when a context can be created", () => {
    expect(isWebGLAvailable(() => ({}))).toBe(true);
  });

  it("reports unavailable for null or a thrown probe", () => {
    expect(isWebGLAvailable(() => null)).toBe(false);
    expect(
      isWebGLAvailable(() => {
        throw new Error("blocked");
      }),
    ).toBe(false);
  });
});
