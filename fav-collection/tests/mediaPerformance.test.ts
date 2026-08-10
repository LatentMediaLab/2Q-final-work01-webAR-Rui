import { describe, expect, it } from "vitest";
import { getOversizedMediaWarning } from "../src/scene/mediaPerformance";

describe("media performance warnings", () => {
  it("warns when an image exceeds the recommended dimension", () => {
    expect(
      getOversizedMediaWarning({
        type: "image",
        src: "/large.png",
        width: 4_096,
        height: 2_048,
      }),
    ).toContain("2048");
  });

  it("does not warn for a suitable image", () => {
    expect(
      getOversizedMediaWarning({
        type: "image",
        src: "/suitable.png",
        width: 1_024,
        height: 1_024,
      }),
    ).toBeNull();
  });
});
