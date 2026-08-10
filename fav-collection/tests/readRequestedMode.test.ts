import { describe, expect, it } from "vitest";
import { readRequestedMode } from "../src/app/readRequestedMode";

describe("readRequestedMode", () => {
  it("reads mode=preview", () => {
    expect(readRequestedMode("?mode=preview")).toBe("preview");
  });

  it("reads preview mode alongside other parameters", () => {
    expect(readRequestedMode("?source=test&mode=preview")).toBe("preview");
  });

  it("ignores unsupported mode values", () => {
    expect(readRequestedMode("?mode=ar")).toBeNull();
  });

  it("returns null when the mode parameter is absent", () => {
    expect(readRequestedMode("")).toBeNull();
  });
});
