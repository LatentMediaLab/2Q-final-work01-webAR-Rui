import {
  PostCacheStateError,
  type PostCacheState,
} from "./post-cache-state";
import { PostSyncCoordinator } from "./post-sync-coordinator";
import { type RefreshPostsResult } from "./refresh-posts";
import {
  SyncPostsError,
  type SyncPostsFailureKind,
} from "./sync-posts";

export const POST_CACHE_MAX_AGE_MS = 7 * 60 * 1000;
export const POST_SYNC_RETRY_WAIT_MS = 60 * 1000;

export type EnsurePostsFreshResult =
  | { outcome: "fresh" }
  | { outcome: "retry_wait" }
  | { outcome: "synchronized"; syncResult: RefreshPostsResult }
  | { outcome: "sync_failed"; failureKind: SyncPostsFailureKind };

export class PostCacheCoordinator {
  readonly #cacheState: PostCacheState;
  readonly #postSyncCoordinator: PostSyncCoordinator;
  readonly #now: () => number;

  public constructor({
    cacheState,
    postSyncCoordinator,
    now = Date.now,
  }: {
    cacheState: PostCacheState;
    postSyncCoordinator: PostSyncCoordinator;
    now?: () => number;
  }) {
    this.#cacheState = cacheState;
    this.#postSyncCoordinator = postSyncCoordinator;
    this.#now = now;
  }

  public async syncPostsIfStale(
    hasUsablePosts = true,
  ): Promise<EnsurePostsFreshResult> {
    const currentTime = this.#now();
    validateCurrentTime(currentTime);
    const updatedAt = await this.#cacheState.readLastSuccessfulUpdate();

    if (hasUsablePosts && isPostCacheFresh(updatedAt, currentTime)) {
      return { outcome: "fresh" };
    }

    const lastFailure = await this.#cacheState.readLastSyncFailure();
    if (isPostSyncRetryWaiting(lastFailure, currentTime)) {
      return { outcome: "retry_wait" };
    }

    try {
      const syncResult = await this.#postSyncCoordinator.syncPosts();
      return { outcome: "synchronized", syncResult };
    } catch (error) {
      return {
        outcome: "sync_failed",
        failureKind:
          error instanceof SyncPostsError ? error.kind : "unexpected",
      };
    }
  }
}

export function isPostSyncRetryWaiting(
  lastFailure: number | null,
  currentTime: number,
): boolean {
  validateCurrentTime(currentTime);
  if (lastFailure === null) {
    return false;
  }
  const age = currentTime - lastFailure;
  return age >= 0 && age < POST_SYNC_RETRY_WAIT_MS;
}

export function isPostCacheFresh(
  updatedAt: number | null,
  currentTime: number,
): boolean {
  validateCurrentTime(currentTime);
  if (updatedAt === null) {
    return false;
  }
  const age = currentTime - updatedAt;
  return age >= 0 && age < POST_CACHE_MAX_AGE_MS;
}

function validateCurrentTime(currentTime: number): void {
  if (!Number.isSafeInteger(currentTime) || currentTime < 0) {
    throw new PostCacheStateError("現在時刻を取得できませんでした。");
  }
}
