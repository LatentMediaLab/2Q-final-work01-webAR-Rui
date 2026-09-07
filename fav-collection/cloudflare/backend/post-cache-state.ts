import { type DurableObjectStorageLike } from "./durable-object-token-store";

const POSTS_UPDATED_AT_KEY = "posts:updated_at";
const POSTS_LAST_FAILED_AT_KEY = "posts:last_failed_at";

export interface PostCacheState {
  readLastSuccessfulUpdate(): Promise<number | null>;
  markSuccessfulUpdate(updatedAt: number): Promise<void>;
  readLastSyncFailure(): Promise<number | null>;
  markSyncFailure(failedAt: number): Promise<void>;
}

export class PostCacheStateError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PostCacheStateError";
  }
}

export function createDurableObjectPostCacheState(
  storage: DurableObjectStorageLike,
): PostCacheState {
  return {
    async readLastSuccessfulUpdate(): Promise<number | null> {
      let updatedAt: unknown;
      try {
        updatedAt = await storage.get<unknown>(POSTS_UPDATED_AT_KEY);
      } catch {
        throw new PostCacheStateError("投稿の最終更新時刻を読み込めませんでした。");
      }
      if (updatedAt === undefined) {
        return null;
      }
      validateTimestamp(updatedAt);
      return updatedAt;
    },

    async markSuccessfulUpdate(updatedAt: number): Promise<void> {
      validateTimestamp(updatedAt);
      try {
        await storage.put(POSTS_UPDATED_AT_KEY, updatedAt);
      } catch {
        throw new PostCacheStateError("投稿の最終更新時刻を保存できませんでした。");
      }
    },

    async readLastSyncFailure(): Promise<number | null> {
      let failedAt: unknown;
      try {
        failedAt = await storage.get<unknown>(POSTS_LAST_FAILED_AT_KEY);
      } catch {
        throw new PostCacheStateError("投稿同期の失敗時刻を読み込めませんでした。");
      }
      if (failedAt === undefined) {
        return null;
      }
      validateTimestamp(failedAt);
      return failedAt;
    },

    async markSyncFailure(failedAt: number): Promise<void> {
      validateTimestamp(failedAt);
      try {
        await storage.put(POSTS_LAST_FAILED_AT_KEY, failedAt);
      } catch {
        throw new PostCacheStateError("投稿同期の失敗時刻を保存できませんでした。");
      }
    },
  };
}

function validateTimestamp(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new PostCacheStateError("投稿の最終更新時刻が不正です。");
  }
}
