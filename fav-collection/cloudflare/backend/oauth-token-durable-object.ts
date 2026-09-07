import { DurableObject } from "cloudflare:workers";
import { createDurableObjectOAuthTokenStore } from "./durable-object-token-store";
import { OAuthTokenCoordinator } from "./oauth-token-coordinator";
import { type OAuthTokenState } from "./oauth-token-store";
import {
  PostCacheCoordinator,
  type EnsurePostsFreshResult,
} from "./post-cache-coordinator";
import { createDurableObjectPostCacheState } from "./post-cache-state";
import { PostSyncCoordinator } from "./post-sync-coordinator";
import { type PostsKvWriter } from "./posts-kv-store";
import { type RefreshPostsResult } from "./refresh-posts";
import { syncPosts as runSyncPosts } from "./sync-posts";

interface OAuthTokenDurableObjectEnvironment {
  X_OAUTH_CLIENT_ID: string;
  X_OAUTH_CLIENT_SECRET: string;
  POSTS_STORE: PostsKvWriter;
}

export class OAuthTokenDurableObject extends DurableObject<OAuthTokenDurableObjectEnvironment> {
  readonly #coordinator: OAuthTokenCoordinator;
  readonly #postSyncCoordinator: PostSyncCoordinator;
  readonly #postCacheCoordinator: PostCacheCoordinator;

  public constructor(
    context: DurableObjectState,
    environment: OAuthTokenDurableObjectEnvironment,
  ) {
    super(context, environment);
    const tokenStore = createDurableObjectOAuthTokenStore(context.storage);
    this.#coordinator = new OAuthTokenCoordinator({
      clientId: environment.X_OAUTH_CLIENT_ID,
      clientSecret: environment.X_OAUTH_CLIENT_SECRET,
      tokenStore,
    });
    const postCacheState = createDurableObjectPostCacheState(context.storage);
    this.#postSyncCoordinator = new PostSyncCoordinator(
      async () => {
        const tokenState = await tokenStore.read();
        return runSyncPosts({
          getValidAccessToken: () => this.#coordinator.getValidAccessToken(),
          userId: tokenState.userId,
          postsStore: environment.POSTS_STORE,
        });
      },
      async () => postCacheState.markSuccessfulUpdate(Date.now()),
      async () => postCacheState.markSyncFailure(Date.now()),
    );
    this.#postCacheCoordinator = new PostCacheCoordinator({
      cacheState: postCacheState,
      postSyncCoordinator: this.#postSyncCoordinator,
    });
  }

  public async initializeTokenState(token: OAuthTokenState): Promise<void> {
    await this.#coordinator.initializeTokenState(token);
  }

  public async getValidAccessToken(): Promise<string> {
    return this.#coordinator.getValidAccessToken();
  }

  public async syncPosts(): Promise<RefreshPostsResult> {
    return this.#postSyncCoordinator.syncPosts();
  }

  public async syncPostsIfStale(
    hasUsablePosts = true,
  ): Promise<EnsurePostsFreshResult> {
    return this.#postCacheCoordinator.syncPostsIfStale(hasUsablePosts);
  }
}
