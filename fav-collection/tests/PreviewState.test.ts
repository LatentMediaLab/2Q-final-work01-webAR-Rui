import { describe, expect, it } from "vitest";
import {
  createInitialPreviewUiState,
  reducePreviewUiState,
} from "../src/app/PreviewState";

describe("PreviewUiState", () => {
  it("opens and closes the selected post detail", () => {
    const initial = createInitialPreviewUiState();
    const opened = reducePreviewUiState(initial, {
      type: "open-detail",
      postId: "post-001",
    });

    expect(opened.selectedPostId).toBe("post-001");
    expect(
      reducePreviewUiState(opened, { type: "close-detail" }).selectedPostId,
    ).toBeNull();
  });

  it("toggles captions", () => {
    const initial = createInitialPreviewUiState();
    const captionsHidden = reducePreviewUiState(initial, {
      type: "toggle-captions",
    });

    expect(captionsHidden.captionsVisible).toBe(false);
  });

  it("keeps settings and information panels mutually exclusive", () => {
    const initial = createInitialPreviewUiState();
    const settings = reducePreviewUiState(initial, { type: "open-settings" });
    const info = reducePreviewUiState(settings, { type: "open-info" });

    expect(info.settingsOpen).toBe(false);
    expect(info.infoOpen).toBe(true);
  });
});
