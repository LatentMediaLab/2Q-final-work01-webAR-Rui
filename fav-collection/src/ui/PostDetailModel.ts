import type { PostMediaType, PostRecord } from "../data/PostTypes";

export interface PostDetailMedia {
  readonly type: Exclude<PostMediaType, "text">;
  readonly src: string;
  readonly thumbnailSrc?: string;
  readonly alt: string;
}

export interface PostDetailModel {
  readonly id: string;
  readonly authorName: string;
  readonly authorHandle: string;
  readonly authorIconSrc?: string;
  readonly text?: string;
  readonly media?: PostDetailMedia;
  readonly postedAt?: string;
  readonly likedAt?: string;
  readonly viewCount?: string;
  readonly likeCount?: string;
  readonly postUrl?: string;
}

export function formatPostDetail(post: PostRecord): PostDetailModel {
  const media = post.media.find((item) => item.type === post.mediaType);
  const postedAt = formatPostDate(post.postedAt);
  const likedAt = formatPostDate(post.likedAt);
  const detailMedia =
    media === undefined || post.mediaType === "text"
      ? undefined
      : {
          type: post.mediaType,
          src: media.src,
          ...(media.thumbnailSrc === undefined
            ? {}
            : { thumbnailSrc: media.thumbnailSrc }),
          alt: media.alt?.trim() || `${post.authorName}の投稿メディア`,
        };

  return {
    id: post.id,
    authorName: post.authorName,
    authorHandle: post.authorHandle,
    ...(post.authorIconSrc === undefined
      ? {}
      : { authorIconSrc: post.authorIconSrc }),
    ...(post.text.trim().length === 0 ? {} : { text: post.text }),
    ...(detailMedia === undefined ? {} : { media: detailMedia }),
    ...(postedAt === undefined ? {} : { postedAt }),
    ...(likedAt === undefined ? {} : { likedAt }),
    ...(post.viewCount === undefined
      ? {}
      : { viewCount: formatCount(post.viewCount) }),
    ...(post.likeCount === undefined
      ? {}
      : { likeCount: formatCount(post.likeCount) }),
    ...(post.postUrl === undefined || post.postUrl.trim().length === 0
      ? {}
      : { postUrl: post.postUrl }),
  };
}

export function formatPostDate(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.max(0, value));
}
