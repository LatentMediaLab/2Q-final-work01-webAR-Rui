import { describe, expect, it } from "vitest";
import { readDebugEnabled } from "../src/app/readDebugEnabled";
import { FrameRateMeter } from "../src/debug/DebugOverlay";

describe("debug mode", () => {
  it("is enabled only by debug=true", () => {
    expect(readDebugEnabled("?debug=true")).toBe(true);
    expect(readDebugEnabled("?debug=false")).toBe(false);
    expect(readDebugEnabled("")).toBe(false);
  });

  it("calculates a bounded sample without updating application state", () => {
    const meter = new FrameRateMeter();
    expect(meter.recordFrame(0)).toBe(0);
    for (let frame = 1; frame <= 30; frame += 1) {
      meter.recordFrame(frame * (500 / 30));
    }
    expect(meter.recordFrame(501)).toBeGreaterThan(0);
  });
});
