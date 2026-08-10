export function canUseCameraFallback(
  mediaDevices: MediaDevices | undefined,
): boolean {
  return typeof mediaDevices?.getUserMedia === "function";
}

export function requestRearCamera(mediaDevices: MediaDevices): Promise<MediaStream> {
  return mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
    },
    audio: false,
  });
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function getCameraErrorMessage(error: unknown): string {
  switch (getCameraErrorKind(error)) {
    case "permission":
      return "カメラの利用が許可されませんでした。Safariのサイト設定とHTTPS接続を確認してください。";
    case "not-found":
      return "利用できる背面カメラが見つかりませんでした。";
    case "not-readable":
      return "カメラを開始できませんでした。他のアプリがカメラを使用していないか確認してください。";
    case "unknown":
      return "カメラを開始できませんでした。HTTPS接続と端末のカメラ設定を確認してください。";
  }
}

export type CameraErrorKind =
  | "permission"
  | "not-found"
  | "not-readable"
  | "unknown";

export function getCameraErrorKind(error: unknown): CameraErrorKind {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "permission";
      case "NotFoundError":
      case "OverconstrainedError":
        return "not-found";
      case "NotReadableError":
        return "not-readable";
    }
  }
  return "unknown";
}
