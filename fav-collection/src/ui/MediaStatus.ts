import { APP_CONFIG } from "../app/config";
import type { PostMediaType } from "../data/PostTypes";

export function getMediaPlaceholderSource(
  mediaType: Exclude<PostMediaType, "text">,
): string {
  return mediaType === "image"
    ? APP_CONFIG.data.imagePlaceholderSrc
    : APP_CONFIG.data.videoPlaceholderSrc;
}

export function getMediaLoadErrorMessage(
  mediaType: Exclude<PostMediaType, "text">,
): string {
  return mediaType === "image"
    ? "画像を読み込めませんでした。"
    : "動画を読み込めませんでした。";
}

export function getVideoPlaybackErrorMessage(): string {
  return "動画を再生できませんでした。";
}
