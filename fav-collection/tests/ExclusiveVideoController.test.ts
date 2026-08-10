import { describe, expect, it } from "vitest";
import {
  ExclusiveVideoController,
  type PlayableVideo,
} from "../src/interaction/ExclusiveVideoController";

class MockVideo implements PlayableVideo {
  public currentTime = 12;
  public paused = true;
  public playCount = 0;
  public pauseCount = 0;

  public async play(): Promise<void> {
    this.playCount += 1;
    this.paused = false;
  }

  public pause(): void {
    this.pauseCount += 1;
    this.paused = true;
  }
}

describe("ExclusiveVideoController", () => {
  it("stops the previous video before playing another one", async () => {
    const controller = new ExclusiveVideoController();
    const first = new MockVideo();
    const second = new MockVideo();

    await controller.play(first);
    await controller.play(second);

    expect(first.pauseCount).toBe(1);
    expect(first.currentTime).toBe(0);
    expect(second.playCount).toBe(1);
    expect(controller.isActive(second)).toBe(true);
  });

  it("stops and rewinds the active video", async () => {
    const controller = new ExclusiveVideoController();
    const video = new MockVideo();

    await controller.play(video);
    controller.stopAll();

    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(0);
    expect(controller.isActive(video)).toBe(false);
  });
});
