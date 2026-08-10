export type WebXRSupportStatus =
  | "checking"
  | "supported"
  | "unsupported"
  | "error";

export async function checkImmersiveArSupport(
  xr: XRSystem | undefined,
): Promise<WebXRSupportStatus> {
  if (xr === undefined) {
    return "unsupported";
  }

  try {
    return (await xr.isSessionSupported("immersive-ar"))
      ? "supported"
      : "unsupported";
  } catch (error: unknown) {
    console.warn("[Fav Collection] WebXR対応判定に失敗しました。", error);
    return "error";
  }
}
