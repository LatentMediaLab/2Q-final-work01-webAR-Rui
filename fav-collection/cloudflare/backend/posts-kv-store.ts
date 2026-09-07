import {
  validatePostsSnapshot,
  type PublicPost,
} from "./post-transform";

export const POSTS_CURRENT_KEY = "posts:current";
export const MAX_POSTS_SNAPSHOT_SIZE = 100;

export interface PostsKvWriter {
  put(key: string, value: string): Promise<void>;
}

export interface PostsKvNamespace extends PostsKvWriter {
  get(key: string, type: "text"): Promise<string | null>;
}

export class PostsKvStoreError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PostsKvStoreError";
  }
}

export function createKvPostsSaver(
  namespace: PostsKvWriter,
  key = POSTS_CURRENT_KEY,
): (posts: readonly PublicPost[]) => Promise<void> {
  if (key.trim() === "") {
    throw new PostsKvStoreError("投稿データの保存キーが不正です。");
  }

  return async (posts: readonly PublicPost[]): Promise<void> => {
    validatePostsSnapshot(posts);
    if (posts.length > MAX_POSTS_SNAPSHOT_SIZE) {
      throw new PostsKvStoreError("保存可能な投稿件数を超えています。");
    }

    try {
      await namespace.put(key, JSON.stringify(posts));
    } catch {
      throw new PostsKvStoreError("投稿データをKVへ保存できませんでした。");
    }
  };
}
