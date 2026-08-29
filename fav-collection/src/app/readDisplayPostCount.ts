import { APP_CONFIG } from "./config";

export type DisplayPostCount =
  (typeof APP_CONFIG.performance.displayPostCounts)[number];

export function readDisplayPostCount(search: string): DisplayPostCount {
  const parameters = new URLSearchParams(search);
  const requestedCount = Number(
    parameters.get(APP_CONFIG.routing.countParameter),
  );

  return APP_CONFIG.performance.displayPostCounts.find(
    (count) => count === requestedCount,
  ) ?? APP_CONFIG.performance.defaultDisplayPosts;
}

export function selectPostsForDisplay<T>(
  posts: readonly T[],
  count: DisplayPostCount,
): readonly T[] {
  return posts.slice(0, count);
}

export function sortPostsOldestFirst<T extends { readonly postedAt?: string }>(
  posts: readonly T[],
): T[] {
  return posts
    .map((post, index) => ({ post, index, timestamp: readTimestamp(post.postedAt) }))
    .sort((left, right) => {
      if (left.timestamp === null && right.timestamp === null) {
        return left.index - right.index;
      }
      if (left.timestamp === null) {
        return 1;
      }
      if (right.timestamp === null) {
        return -1;
      }
      return left.timestamp - right.timestamp || left.index - right.index;
    })
    .map(({ post }) => post);
}

function readTimestamp(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}
