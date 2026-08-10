export interface PreviewUiState {
  readonly selectedPostId: string | null;
  readonly textAnimationPaused: boolean;
  readonly captionsVisible: boolean;
  readonly settingsOpen: boolean;
  readonly infoOpen: boolean;
}

export type PreviewUiAction =
  | { readonly type: "open-detail"; readonly postId: string }
  | { readonly type: "close-detail" }
  | { readonly type: "toggle-text-animation" }
  | { readonly type: "set-text-animation-paused"; readonly paused: boolean }
  | { readonly type: "toggle-captions" }
  | { readonly type: "open-settings" }
  | { readonly type: "close-settings" }
  | { readonly type: "open-info" }
  | { readonly type: "close-info" };

export function createInitialPreviewUiState(
  reducedMotion: boolean,
): PreviewUiState {
  return {
    selectedPostId: null,
    textAnimationPaused: reducedMotion,
    captionsVisible: true,
    settingsOpen: false,
    infoOpen: false,
  };
}

export function reducePreviewUiState(
  state: PreviewUiState,
  action: PreviewUiAction,
): PreviewUiState {
  switch (action.type) {
    case "open-detail":
      return {
        ...state,
        selectedPostId: action.postId,
        settingsOpen: false,
        infoOpen: false,
      };
    case "close-detail":
      return { ...state, selectedPostId: null };
    case "toggle-text-animation":
      return { ...state, textAnimationPaused: !state.textAnimationPaused };
    case "set-text-animation-paused":
      return { ...state, textAnimationPaused: action.paused };
    case "toggle-captions":
      return { ...state, captionsVisible: !state.captionsVisible };
    case "open-settings":
      return { ...state, settingsOpen: true, infoOpen: false };
    case "close-settings":
      return { ...state, settingsOpen: false };
    case "open-info":
      return { ...state, infoOpen: true, settingsOpen: false };
    case "close-info":
      return { ...state, infoOpen: false };
  }
}
