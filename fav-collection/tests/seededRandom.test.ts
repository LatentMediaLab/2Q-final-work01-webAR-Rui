import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  hashStringToSeed,
} from "../src/utils/seededRandom";

describe("seeded random", () => {
  it("reproduces the same sequence for the same seed", () => {
    const first = createSeededRandom(12345);
    const second = createSeededRandom(12345);

    expect(Array.from({ length: 8 }, first)).toEqual(
      Array.from({ length: 8 }, second),
    );
  });

  it("creates a stable unsigned seed from a post ID", () => {
    expect(hashStringToSeed("post-stable-id")).toBe(
      hashStringToSeed("post-stable-id"),
    );
    expect(hashStringToSeed("post-stable-id")).not.toBe(
      hashStringToSeed("another-post-id"),
    );
    expect(hashStringToSeed("post-stable-id")).toBeGreaterThanOrEqual(0);
  });
});
