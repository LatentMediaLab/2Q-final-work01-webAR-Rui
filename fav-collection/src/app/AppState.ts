import type { ArPlacementState } from "../ar/ArState";
import type {
  FallbackPlacementState,
  FallbackTrackingMode,
} from "../ar/FallbackState";
import type { WebXRSupportStatus } from "../ar/WebXRSupport";
import type { PreviewUiState } from "./PreviewState";
import type { AppErrorKind } from "./ErrorRecovery";

export type AppMode =
  | "boot"
  | "intro"
  | "loading"
  | "preview"
  | "scanning"
  | "placed"
  | "detail"
  | "fallback"
  | "error";

export type RequestedMode = Extract<AppMode, "preview"> | null;

export interface AppErrorState {
  kind: AppErrorKind;
  title: string;
  message: string;
}

export interface AppState {
  mode: AppMode;
  requestedMode: RequestedMode;
  notice: string | null;
  error: AppErrorState | null;
  postCount: number;
  previewUi: PreviewUiState;
  arSupportStatus: WebXRSupportStatus;
  arPlacementState: ArPlacementState;
  fallbackPlacementState: FallbackPlacementState;
  fallbackTrackingMode: FallbackTrackingMode | null;
  detailReturnMode: Extract<AppMode, "preview" | "placed" | "fallback"> | null;
  playingVideoId: string | null;
}
