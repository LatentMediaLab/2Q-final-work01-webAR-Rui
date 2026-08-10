import { describe, expect, it } from "vitest";
import { getArInstruction, reduceArPlacementState } from "../src/ar/ArState";

describe("AR placement state", () => {
  it("moves through loading, scanning, ready, and placed", () => {
    const scanning = reduceArPlacementState("loading", { type: "data-loaded" });
    const ready = reduceArPlacementState(scanning, { type: "hit-found" });
    const placed = reduceArPlacementState(ready, { type: "place" });

    expect(scanning).toBe("scanning");
    expect(ready).toBe("ready");
    expect(placed).toBe("placed");
    expect(getArInstruction(placed)).toBe(
      "投稿をタップすると詳細を表示します。",
    );
  });

  it("returns to scanning when repositioning", () => {
    expect(
      reduceArPlacementState("placed", { type: "reposition" }),
    ).toBe("scanning");
  });

  it("does not place without a valid hit", () => {
    expect(reduceArPlacementState("scanning", { type: "place" })).toBe(
      "scanning",
    );
  });
});
