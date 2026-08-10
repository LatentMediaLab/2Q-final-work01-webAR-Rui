export type AppErrorKind =
  | "webgl"
  | "xr-session"
  | "xr-ended"
  | "camera-permission"
  | "camera-unavailable"
  | "data"
  | "empty-data"
  | "exhibition";

export type RecoveryAction = "retry" | "fallback" | "preview" | "intro";

export interface RecoveryOption {
  readonly action: RecoveryAction;
  readonly label: string;
}

export function getRecoveryOptions(
  kind: AppErrorKind,
  cameraAvailable: boolean,
): RecoveryOption[] {
  switch (kind) {
    case "xr-session":
    case "xr-ended":
      return compactOptions([
        cameraAvailable
          ? { action: "fallback", label: "簡易ARへ移行" }
          : null,
        { action: "preview", label: "通常プレビューへ移行" },
        { action: "intro", label: "起動画面へ戻る" },
      ]);
    case "camera-permission":
    case "camera-unavailable":
      return [
        { action: "retry", label: "カメラを再試行" },
        { action: "preview", label: "通常プレビューへ移行" },
        { action: "intro", label: "起動画面へ戻る" },
      ];
    case "data":
    case "empty-data":
      return [
        { action: "retry", label: "投稿データを再読み込み" },
        { action: "intro", label: "起動画面へ戻る" },
      ];
    case "webgl":
    case "exhibition":
      return [
        { action: "retry", label: "表示を再試行" },
        { action: "intro", label: "起動画面へ戻る" },
      ];
  }
}

function compactOptions(
  options: readonly (RecoveryOption | null)[],
): RecoveryOption[] {
  return options.filter((option): option is RecoveryOption => option !== null);
}
