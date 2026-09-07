import { createKvPostsSaver, type PostsKvWriter } from "./posts-kv-store";
import {
  refreshPosts,
  type GetAccessToken,
  type RefreshPostsResult,
} from "./refresh-posts";
import { type XApiFetch } from "./x-api";

export async function refreshPostsToKv({
  getAccessToken,
  userId,
  maxResults,
  postsStore,
  fetchImplementation = fetch,
}: {
  getAccessToken: GetAccessToken;
  userId: string;
  maxResults?: number;
  postsStore: PostsKvWriter;
  fetchImplementation?: XApiFetch;
}): Promise<RefreshPostsResult> {
  return refreshPosts({
    getAccessToken,
    userId,
    ...(maxResults === undefined ? {} : { maxResults }),
    savePosts: createKvPostsSaver(postsStore),
    fetchImplementation,
  });
}
