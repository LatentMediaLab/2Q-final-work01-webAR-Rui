export type PostMediaType = "image" | "video" | "text";

export interface PostMedia {
  type: "image" | "video";
  src: string;
  thumbnailSrc?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface PostRecord {
  id: string;
  postUrl?: string;
  authorName: string;
  authorHandle: string;
  authorIconSrc?: string;
  text: string;
  mediaType: PostMediaType;
  media: PostMedia[];
  viewCount?: number;
  likeCount?: number;
  repostCount?: number;
  postedAt?: string;
  likedAt?: string;
  tags?: string[];
  displaySeed?: number;
}
