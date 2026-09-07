import { AccessTokenProviderConfigError } from "./access-token-provider";
import {
  OAuthRefreshConfigError,
  OAuthRefreshRequestError,
} from "./oauth-refresh";
import { OAuthTokenStoreError } from "./oauth-token-store";
import { PostTransformError } from "./post-transform";
import {
  PostsKvStoreError,
  type PostsKvWriter,
} from "./posts-kv-store";
import { refreshPostsToKv } from "./refresh-posts-to-kv";
import {
  type GetAccessToken,
  type RefreshPostsResult,
} from "./refresh-posts";
import {
  XApiConfigError,
  type XApiFetch,
  XApiRequestError,
  XApiResponseError,
} from "./x-api";

export type SyncPostsFailureKind =
  | "oauth_refresh"
  | "oauth_token_state"
  | "x_api_request"
  | "invalid_response"
  | "transformation"
  | "kv_write"
  | "configuration"
  | "unexpected";

export class SyncPostsError extends Error {
  public readonly kind: SyncPostsFailureKind;

  public constructor(kind: SyncPostsFailureKind, message: string) {
    super(message);
    this.name = "SyncPostsError";
    this.kind = kind;
  }
}

export async function syncPosts({
  getValidAccessToken,
  userId,
  maxResults,
  postsStore,
  fetchImplementation = fetch,
}: {
  getValidAccessToken: GetAccessToken;
  userId: string;
  maxResults?: number;
  postsStore: PostsKvWriter;
  fetchImplementation?: XApiFetch;
}): Promise<RefreshPostsResult> {
  try {
    return await refreshPostsToKv({
      getAccessToken: getValidAccessToken,
      userId,
      ...(maxResults === undefined ? {} : { maxResults }),
      postsStore,
      fetchImplementation,
    });
  } catch (error) {
    throw classifySyncError(error);
  }
}

function classifySyncError(error: unknown): SyncPostsError {
  if (error instanceof OAuthRefreshRequestError) {
    return new SyncPostsError(
      "oauth_refresh",
      "OAuth tokenの更新に失敗したため、投稿を同期できませんでした。",
    );
  }
  if (error instanceof OAuthTokenStoreError) {
    return new SyncPostsError(
      "oauth_token_state",
      "OAuth tokenの保存状態を利用できないため、投稿を同期できませんでした。",
    );
  }
  if (error instanceof XApiRequestError) {
    return new SyncPostsError(
      "x_api_request",
      "X APIから投稿を取得できませんでした。",
    );
  }
  if (error instanceof XApiResponseError) {
    return new SyncPostsError(
      "invalid_response",
      "X APIの応答が不正なため、投稿を同期できませんでした。",
    );
  }
  if (error instanceof PostTransformError) {
    return new SyncPostsError(
      "transformation",
      "投稿データを整形できないため、投稿を同期できませんでした。",
    );
  }
  if (error instanceof PostsKvStoreError) {
    return new SyncPostsError(
      "kv_write",
      "投稿データをKVへ保存できませんでした。",
    );
  }
  if (
    error instanceof OAuthRefreshConfigError ||
    error instanceof AccessTokenProviderConfigError ||
    error instanceof XApiConfigError
  ) {
    return new SyncPostsError(
      "configuration",
      "同期処理の設定が不正です。",
    );
  }
  return new SyncPostsError(
    "unexpected",
    "予期しない理由で投稿を同期できませんでした。",
  );
}
