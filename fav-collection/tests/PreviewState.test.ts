import { describe, expect, it } from "vitest";
import {
  createInitialPreviewUiState,
  reducePreviewUiState,
} from "../src/app/PreviewState";

describe("PreviewUiState", () => {
  it("starts text animation paused when reduced motion is preferred", () => {
    expect(createInitialPreviewUiState(true).textAnimationPaused).toBe(true);
    expect(createInitialPreviewUiState(false).textAnimationPaused).toBe(false);
  });

  it("pauses text when reduced-motion preference changes", () => {
    const initial = createInitialPreviewUiState(false);
    expect(
      reducePreviewUiState(initial, {
        type: "set-text-animation-paused",
        paused: true,
      }).textAnimationPaused,
    ).toBe(true);
  });

  it("opens and closes the selected post detail", () => {
    const initial = createInitialPreviewUiState(false);
    const opened = reducePreviewUiState(initial, {
      type: "open-detail",
      postId: "post-001",
    });

    expect(opened.selectedPostId).toBe("post-001");
    expect(
      reducePreviewUiState(opened, { type: "close-detail" }).selectedPostId,
    ).toBeNull();
  });

  it("toggles text animation and captions independently", () => {
    const initial = createInitialPreviewUiState(false);
    const paused = reducePreviewUiState(initial, {
      type: "toggle-text-animation",
    });
    const captionsHidden = reducePreviewUiState(paused, {
      type: "toggle-captions",
    });

    expect(captionsHidden.textAnimationPaused).toBe(true);
    expect(captionsHidden.captionsVisible).toBe(false);
  });

  it("keeps settings and information panels mutually exclusive", () => {
    const initial = createInitialPreviewUiState(false);
    const settings = reducePreviewUiState(initial, { type: "open-settings" });
    const info = reducePreviewUiState(settings, { type: "open-info" });

    expect(info.settingsOpen).toBe(false);
    expect(info.infoOpen).toBe(true);
  });
});
