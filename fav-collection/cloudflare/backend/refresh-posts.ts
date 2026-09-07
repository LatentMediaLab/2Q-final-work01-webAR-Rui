import {
  transformXResponse,
  type PublicPost,
} from "./post-transform";
import {
  fetchXLikedPosts,
  type XApiFetch,
} from "./x-api";

export interface RefreshPostsResult {
  fetchedCount: number;
  savedCount: number;
  skippedCount: number;
  posts: PublicPost[];
}

export type SavePosts = (posts: readonly PublicPost[]) => Promise<void>;
export type GetAccessToken = () => Promise<string>;

export async function refreshPosts({
  getAccessToken,
  userId,
  maxResults,
  savePosts,
  fetchImplementation = fetch,
}: {
  getAccessToken: GetAccessToken;
  userId: string;
  maxResults?: number;
  savePosts: SavePosts;
  fetchImplementation?: XApiFetch;
}): Promise<RefreshPostsResult> {
  const accessToken = await getAccessToken();
  const responseBody = await fetchXLikedPosts({
    accessToken,
    userId,
    ...(maxResults === undefined ? {} : { maxResults }),
    fetchImplementation,
  });
  const result = transformXResponse(responseBody);
  await savePosts(result.posts);

  return {
    fetchedCount: result.sourceCount,
    savedCount: result.posts.length,
    skippedCount: result.skippedCount,
    posts: result.posts,
  };
}
