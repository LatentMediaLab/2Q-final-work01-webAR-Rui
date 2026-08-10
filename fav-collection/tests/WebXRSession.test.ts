import { describe, expect, it } from "vitest";
import { createArSessionInit } from "../src/ar/WebXRSession";

describe("createArSessionInit", () => {
  it("requires hit-test and keeps other XR features optional", () => {
    const overlayRoot = {} as Element;
    const init = createArSessionInit(overlayRoot);

    expect(init.requiredFeatures).toEqual(["hit-test"]);
    expect(init.optionalFeatures).toEqual([
      "local-floor",
      "dom-overlay",
      "anchors",
    ]);
    expect(init.domOverlay?.root).toBe(overlayRoot);
  });
});
