import { describe, expect, it } from "vitest";
import { getRecoveryOptions } from "../src/app/ErrorRecovery";

describe("error recovery policy", () => {
  it("offers fallback and preview after a WebXR session failure", () => {
    expect(
      getRecoveryOptions("xr-session", true).map((option) => option.action),
    ).toEqual(["fallback", "preview", "intro"]);
  });

  it("omits fallback when no camera API is available", () => {
    expect(
      getRecoveryOptions("xr-session", false).map((option) => option.action),
    ).toEqual(["preview", "intro"]);
  });

  it("offers preview after fallback camera failure", () => {
    expect(
      getRecoveryOptions("camera-permission", true).map(
        (option) => option.action,
      ),
    ).toContain("preview");
  });
});
