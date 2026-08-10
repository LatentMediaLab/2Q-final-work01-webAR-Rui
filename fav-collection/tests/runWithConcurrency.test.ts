import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "../src/utils/runWithConcurrency";

describe("runWithConcurrency", () => {
  it("processes 50 items without exceeding the requested concurrency", async () => {
    let active = 0;
    let maximumActive = 0;
    const completed: number[] = [];

    await runWithConcurrency(
      Array.from({ length: 50 }, (_unused, index) => index),
      4,
      async (item) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 1);
        });
        completed.push(item);
        active -= 1;
      },
    );

    expect(completed).toHaveLength(50);
    expect(new Set(completed).size).toBe(50);
    expect(maximumActive).toBeLessThanOrEqual(4);
  });

  it("uses at least one worker when given an invalidly small limit", async () => {
    const completed: number[] = [];
    await runWithConcurrency([1, 2], 0, async (item) => {
      completed.push(item);
    });
    expect(completed).toEqual([1, 2]);
  });
});
