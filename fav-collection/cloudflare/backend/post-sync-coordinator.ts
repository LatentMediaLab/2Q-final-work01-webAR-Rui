import { type RefreshPostsResult } from "./refresh-posts";

export type PostSyncOperation = () => Promise<RefreshPostsResult>;
export type PostSyncSuccessHandler = (
  result: RefreshPostsResult,
) => Promise<void>;
export type PostSyncFailureHandler = (error: unknown) => Promise<void>;

export class PostSyncCoordinator {
  readonly #syncOperation: PostSyncOperation;
  readonly #onSuccess: PostSyncSuccessHandler | undefined;
  readonly #onFailure: PostSyncFailureHandler | undefined;
  #syncPromise: Promise<RefreshPostsResult> | null = null;

  public constructor(
    syncOperation: PostSyncOperation,
    onSuccess?: PostSyncSuccessHandler,
    onFailure?: PostSyncFailureHandler,
  ) {
    this.#syncOperation = syncOperation;
    this.#onSuccess = onSuccess;
    this.#onFailure = onFailure;
  }

  public syncPosts(): Promise<RefreshPostsResult> {
    if (this.#syncPromise === null) {
      this.#syncPromise = this.#runOnce().finally(() => {
        this.#syncPromise = null;
      });
    }
    return this.#syncPromise;
  }

  async #runOnce(): Promise<RefreshPostsResult> {
    try {
      const result = await this.#syncOperation();
      await this.#onSuccess?.(result);
      return result;
    } catch (error) {
      await this.#onFailure?.(error);
      throw error;
    }
  }
}
