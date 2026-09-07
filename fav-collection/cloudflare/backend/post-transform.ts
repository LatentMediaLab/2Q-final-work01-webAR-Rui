export interface PublicPostMedia {
  type: "image" | "video";
  src: string;
  thumbnailSrc?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface PublicPost {
  id: string;
  postUrl?: string;
  authorName: string;
  authorHandle: string;
  authorIconSrc?: string;
  text: string;
  mediaType: "image" | "video" | "text";
  media: PublicPostMedia[];
  postedAt?: string;
  likedAt?: string;
  viewCount?: number;
  likeCount?: number;
  repostCount?: number;
  tags?: string[];
  displaySeed?: number;
}

export interface TransformXResponseResult {
  posts: PublicPost[];
  sourceCount: number;
  skippedCount: number;
}

type UnknownRecord = Record<string, unknown>;

const ALLOWED_POST_FIELDS = new Set([
  "id",
  "postUrl",
  "authorName",
  "authorHandle",
  "authorIconSrc",
  "text",
  "mediaType",
  "media",
  "postedAt",
  "likedAt",
  "viewCount",
  "likeCount",
  "repostCount",
  "tags",
  "displaySeed",
]);

const ALLOWED_MEDIA_FIELDS = new Set([
  "type",
  "src",
  "thumbnailSrc",
  "alt",
  "width",
  "height",
]);

export class PostTransformError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PostTransformError";
  }
}

export function transformXResponse(
  responseBody: unknown,
): TransformXResponseResult {
  if (!isRecord(responseBody) || !Array.isArray(responseBody.data)) {
    throw new PostTransformError("X API応答に投稿配列が含まれていません。");
  }

  const includes = isRecord(responseBody.includes)
    ? responseBody.includes
    : undefined;
  const usersById = indexByStringField(includes?.users, "id");
  const mediaByKey = indexByStringField(includes?.media, "media_key");
  const posts: PublicPost[] = [];
  let skippedCount = 0;

  for (const candidate of responseBody.data) {
    const post = transformPost(candidate, usersById, mediaByKey);
    if (post === null) {
      skippedCount += 1;
    } else {
      posts.push(post);
    }
  }

  validatePostsSnapshot(posts);
  return {
    posts,
    sourceCount: responseBody.data.length,
    skippedCount,
  };
}

export function validatePostsSnapshot(
  posts: unknown,
): asserts posts is PublicPost[] {
  if (!Array.isArray(posts)) {
    throw new PostTransformError("整形済み投稿データのルートが配列ではありません。");
  }
  if (posts.length === 0) {
    throw new PostTransformError(
      "保存可能な投稿が0件のため、既存データを維持します。",
    );
  }

  const seenIds = new Set<string>();
  for (const post of posts) {
    validatePost(post);
    if (seenIds.has(post.id)) {
      throw new PostTransformError("整形済み投稿データに重複IDがあります。");
    }
    seenIds.add(post.id);
  }
}

function transformPost(
  candidate: unknown,
  usersById: ReadonlyMap<string, UnknownRecord>,
  mediaByKey: ReadonlyMap<string, UnknownRecord>,
): PublicPost | null {
  if (
    !isRecord(candidate) ||
    !isNonEmptyString(candidate.id) ||
    typeof candidate.text !== "string" ||
    !isNonEmptyString(candidate.author_id)
  ) {
    return null;
  }

  const author = usersById.get(candidate.author_id);
  if (
    author === undefined ||
    !isNonEmptyString(author.name) ||
    !isNonEmptyString(author.username)
  ) {
    return null;
  }

  const attachments = isRecord(candidate.attachments)
    ? candidate.attachments
    : undefined;
  const mediaKeys = Array.isArray(attachments?.media_keys)
    ? attachments.media_keys
    : [];
  if (containsVideoOrAnimatedGif(mediaKeys, mediaByKey)) {
    return null;
  }

  const media = mediaKeys.flatMap((mediaKey): PublicPostMedia[] => {
    if (typeof mediaKey !== "string") {
      return [];
    }
    const transformedMedia = transformMedia(mediaByKey.get(mediaKey));
    return transformedMedia === null ? [] : [transformedMedia];
  });
  const mediaType = media.some((item) => item.type === "video")
    ? "video"
    : media.some((item) => item.type === "image")
      ? "image"
      : "text";
  const metrics = isRecord(candidate.public_metrics)
    ? candidate.public_metrics
    : {};
  const post: PublicPost = {
    id: candidate.id,
    postUrl: `https://x.com/${encodeURIComponent(author.username)}/status/${candidate.id}`,
    authorName: author.name,
    authorHandle: `@${author.username}`,
    text: candidate.text,
    mediaType,
    media,
  };

  copyOptionalString(post, "authorIconSrc", author.profile_image_url);
  copyOptionalString(post, "postedAt", candidate.created_at);
  copyOptionalCount(post, "viewCount", metrics.impression_count);
  copyOptionalCount(post, "likeCount", metrics.like_count);
  copyOptionalCount(post, "repostCount", metrics.retweet_count);
  return post;
}

function containsVideoOrAnimatedGif(
  mediaKeys: unknown[],
  mediaByKey: ReadonlyMap<string, UnknownRecord>,
): boolean {
  return mediaKeys.some((mediaKey) => {
    if (typeof mediaKey !== "string") {
      return false;
    }
    const media = mediaByKey.get(mediaKey);
    return (
      media !== undefined &&
      (media.type === "video" || media.type === "animated_gif")
    );
  });
}

function transformMedia(candidate: UnknownRecord | undefined): PublicPostMedia | null {
  if (candidate === undefined) {
    return null;
  }

  if (candidate.type === "photo" && isNonEmptyString(candidate.url)) {
    const media: PublicPostMedia = { type: "image", src: candidate.url };
    addMediaMetadata(media, candidate);
    return media;
  }

  if (candidate.type === "video" || candidate.type === "animated_gif") {
    const source = selectVideoSource(candidate.variants);
    if (source === null) {
      return null;
    }
    const media: PublicPostMedia = { type: "video", src: source };
    addMediaMetadata(media, candidate);
    copyOptionalString(media, "thumbnailSrc", candidate.preview_image_url);
    return media;
  }

  return null;
}

function selectVideoSource(variants: unknown): string | null {
  if (!Array.isArray(variants)) {
    return null;
  }

  const candidates = variants
    .filter(
      (variant): variant is UnknownRecord =>
        isRecord(variant) &&
        variant.content_type === "video/mp4" &&
        isNonEmptyString(variant.url),
    )
    .sort(
      (left, right) =>
        numberOrZero(right.bit_rate) - numberOrZero(left.bit_rate),
    );
  const source = candidates[0]?.url;
  return typeof source === "string" ? source : null;
}

function addMediaMetadata(media: PublicPostMedia, source: UnknownRecord): void {
  copyOptionalPositiveNumber(media, "width", source.width);
  copyOptionalPositiveNumber(media, "height", source.height);
  copyOptionalString(media, "alt", source.alt_text);
}

function validatePost(post: unknown): asserts post is PublicPost {
  if (
    !isRecord(post) ||
    !isNonEmptyString(post.id) ||
    typeof post.authorName !== "string" ||
    typeof post.authorHandle !== "string" ||
    typeof post.text !== "string" ||
    (post.mediaType !== "image" &&
      post.mediaType !== "video" &&
      post.mediaType !== "text") ||
    !Array.isArray(post.media)
  ) {
    throw new PostTransformError("整形済み投稿データの必須項目が不正です。");
  }
  if (!hasOnlyAllowedFields(post, ALLOWED_POST_FIELDS)) {
    throw new PostTransformError(
      "整形済み投稿データに許可されていない項目があります。",
    );
  }

  for (const item of post.media) {
    validateMedia(item);
  }
  if (
    post.mediaType === "image" &&
    !post.media.some((item) => isRecord(item) && item.type === "image")
  ) {
    throw new PostTransformError("画像投稿に利用可能な画像がありません。");
  }
  if (
    post.mediaType === "video" &&
    !post.media.some((item) => isRecord(item) && item.type === "video")
  ) {
    throw new PostTransformError("動画投稿に利用可能な動画がありません。");
  }

  for (const field of [
    "postUrl",
    "authorIconSrc",
    "postedAt",
    "likedAt",
  ]) {
    if (post[field] !== undefined && typeof post[field] !== "string") {
      throw new PostTransformError("整形済み投稿データの文字列項目が不正です。");
    }
  }
  for (const field of [
    "viewCount",
    "likeCount",
    "repostCount",
    "displaySeed",
  ]) {
    const value = post[field];
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    ) {
      throw new PostTransformError("整形済み投稿データの数値項目が不正です。");
    }
  }
  if (
    post.tags !== undefined &&
    (!Array.isArray(post.tags) ||
      !post.tags.every((tag) => typeof tag === "string"))
  ) {
    throw new PostTransformError("整形済み投稿データのタグが不正です。");
  }
}

function validateMedia(media: unknown): asserts media is PublicPostMedia {
  if (
    !isRecord(media) ||
    (media.type !== "image" && media.type !== "video") ||
    !isNonEmptyString(media.src)
  ) {
    throw new PostTransformError("整形済みメディアデータが不正です。");
  }
  if (!hasOnlyAllowedFields(media, ALLOWED_MEDIA_FIELDS)) {
    throw new PostTransformError(
      "整形済みメディアデータに許可されていない項目があります。",
    );
  }
  for (const field of ["thumbnailSrc", "alt"]) {
    if (media[field] !== undefined && typeof media[field] !== "string") {
      throw new PostTransformError("整形済みメディアの文字列項目が不正です。");
    }
  }
  for (const field of ["width", "height"]) {
    const value = media[field];
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    ) {
      throw new PostTransformError("整形済みメディアの寸法が不正です。");
    }
  }
}

function indexByStringField(
  values: unknown,
  field: string,
): Map<string, UnknownRecord> {
  const index = new Map<string, UnknownRecord>();
  if (!Array.isArray(values)) {
    return index;
  }
  for (const value of values) {
    if (isRecord(value) && isNonEmptyString(value[field])) {
      index.set(value[field], value);
    }
  }
  return index;
}

function copyOptionalString<T extends object, K extends keyof T>(
  target: T,
  field: K,
  value: unknown,
): void {
  if (typeof value === "string") {
    target[field] = value as T[K];
  }
}

function copyOptionalCount<T extends object, K extends keyof T>(
  target: T,
  field: K,
  value: unknown,
): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[field] = Math.max(0, value) as T[K];
  }
}

function copyOptionalPositiveNumber<T extends object, K extends keyof T>(
  target: T,
  field: K,
  value: unknown,
): void {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    target[field] = value as T[K];
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyAllowedFields(
  value: UnknownRecord,
  allowedFields: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((field) => allowedFields.has(field));
}
