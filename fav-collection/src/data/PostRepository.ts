import type { PostRecord } from "./PostTypes";

export interface PostRepository {
  getPosts(): Promise<PostRecord[]>;
}
