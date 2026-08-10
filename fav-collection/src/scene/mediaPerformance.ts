import { APP_CONFIG } from "../app/config";
import type { PostMedia } from "../data/PostTypes";

export function getOversizedMediaWarning(
  media: PostMedia,
): string | null {
  const width = media.width ?? 0;
  const height = media.height ?? 0;
  if (
    width <= APP_CONFIG.performance.recommendedMaxImageDimension &&
    height <= APP_CONFIG.performance.recommendedMaxImageDimension
  ) {
    return null;
  }
  return `${width}×${height}pxの素材です。最大辺${APP_CONFIG.performance.recommendedMaxImageDimension}px以下への縮小を推奨します。`;
}
