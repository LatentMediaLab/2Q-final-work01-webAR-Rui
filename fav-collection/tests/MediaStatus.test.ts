import { describe, expect, it } from "vitest";
import {
  getMediaLoadErrorMessage,
  getMediaPlaceholderSource,
  getVideoPlaybackErrorMessage,
} from "../src/ui/MediaStatus";

describe("media error status", () => {
  it("returns a clear image loading error", () => {
    expect(getMediaLoadErrorMessage("image")).toContain("画像");
  });

  it("distinguishes video loading and playback errors", () => {
    expect(getMediaLoadErrorMessage("video")).toContain("読み込めません");
    expect(getVideoPlaybackErrorMessage()).toContain("再生できません");
  });

  it("returns local placeholder sources for image and video media", () => {
    expect(getMediaPlaceholderSource("image")).toContain("image-placeholder.svg");
    expect(getMediaPlaceholderSource("video")).toContain("video-placeholder.svg");
  });
});
