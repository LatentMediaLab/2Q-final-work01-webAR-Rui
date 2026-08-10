import { APP_CONFIG } from "../app/config";
import { resolvePublicUrl } from "../utils/publicUrl";
import type { PostMedia, PostMediaType, PostRecord } from "./PostTypes";

export type ValidationIssueCode =
  | "invalid-root"
  | "invalid-record"
  | "duplicate-id";

export interface ValidationIssue {
  code: ValidationIssueCode;
  index: number | null;
  id?: string;
  message: string;
}

export interface PostValidationResult {
  posts: PostRecord[];
  issues: ValidationIssue[];
}

type UnknownRecord = Record<string, unknown>;

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const optionalStringFields = [
  "postUrl",
  "authorIconSrc",
  "postedAt",
  "likedAt",
] as const;

const optionalCountFields = [
  "viewCount",
  "likeCount",
  "repostCount",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPostMediaType(value: unknown): value is PostMediaType {
  return value === "image" || value === "video" || value === "text";
}

function parseMediaItem(value: unknown): ParseResult<PostMedia> {
  if (!isRecord(value)) {
    return { ok: false, message: "mediaの要素はオブジェクトである必要があります。" };
  }

  if (value.type !== "image" && value.type !== "video") {
    return { ok: false, message: "media.typeはimageまたはvideoである必要があります。" };
  }

  if (!isNonEmptyString(value.src)) {
    return { ok: false, message: "media.srcは空でない文字列である必要があります。" };
  }

  if (
    value.thumbnailSrc !== undefined &&
    typeof value.thumbnailSrc !== "string"
  ) {
    return { ok: false, message: "media.thumbnailSrcは文字列である必要があります。" };
  }

  if (value.alt !== undefined && typeof value.alt !== "string") {
    return { ok: false, message: "media.altは文字列である必要があります。" };
  }

  for (const dimension of ["width", "height"] as const) {
    const dimensionValue = value[dimension];
    if (
      dimensionValue !== undefined &&
      (!isFiniteNumber(dimensionValue) || dimensionValue <= 0)
    ) {
      return {
        ok: false,
        message: `media.${dimension}は正の有限数である必要があります。`,
      };
    }
  }

  const media: PostMedia = {
    type: value.type,
    src: value.src,
  };

  if (typeof value.thumbnailSrc === "string") {
    media.thumbnailSrc = value.thumbnailSrc;
  }
  if (typeof value.alt === "string") {
    media.alt = value.alt;
  }
  if (isFiniteNumber(value.width)) {
    media.width = value.width;
  }
  if (isFiniteNumber(value.height)) {
    media.height = value.height;
  }

  return { ok: true, value: media };
}

function parseMedia(value: unknown): ParseResult<PostMedia[]> {
  if (!Array.isArray(value)) {
    return { ok: false, message: "mediaは配列である必要があります。" };
  }

  const media: PostMedia[] = [];
  for (const item of value) {
    const parsedItem = parseMediaItem(item);
    if (!parsedItem.ok) {
      return parsedItem;
    }
    media.push(parsedItem.value);
  }

  return { ok: true, value: media };
}

function parsePost(value: unknown): ParseResult<PostRecord> {
  if (!isRecord(value)) {
    return { ok: false, message: "投稿はオブジェクトである必要があります。" };
  }

  if (!isNonEmptyString(value.id)) {
    return { ok: false, message: "idは空でない文字列である必要があります。" };
  }
  if (typeof value.authorName !== "string") {
    return { ok: false, message: "authorNameは文字列である必要があります。" };
  }
  if (typeof value.authorHandle !== "string") {
    return { ok: false, message: "authorHandleは文字列である必要があります。" };
  }
  if (typeof value.text !== "string") {
    return { ok: false, message: "textは文字列である必要があります。" };
  }
  if (!isPostMediaType(value.mediaType)) {
    return {
      ok: false,
      message: "mediaTypeはimage、video、textのいずれかである必要があります。",
    };
  }

  const parsedMedia = parseMedia(value.media);
  if (!parsedMedia.ok) {
    return parsedMedia;
  }

  if (
    value.mediaType === "image" &&
    !parsedMedia.value.some((item) => item.type === "image")
  ) {
    return {
      ok: false,
      message: "画像投稿にはimageタイプのmediaが1件以上必要です。",
    };
  }

  if (
    value.mediaType === "video" &&
    !parsedMedia.value.some((item) => item.type === "video")
  ) {
    return {
      ok: false,
      message: "動画投稿にはvideoタイプのmediaが1件以上必要です。",
    };
  }

  for (const field of optionalStringFields) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      return { ok: false, message: `${field}は文字列である必要があります。` };
    }
  }

  for (const field of optionalCountFields) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && !isFiniteNumber(fieldValue)) {
      return { ok: false, message: `${field}は有限数である必要があります。` };
    }
  }

  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) ||
      !value.tags.every((tag) => typeof tag === "string"))
  ) {
    return { ok: false, message: "tagsは文字列の配列である必要があります。" };
  }

  if (value.displaySeed !== undefined && !isFiniteNumber(value.displaySeed)) {
    return { ok: false, message: "displaySeedは有限数である必要があります。" };
  }

  const post: PostRecord = {
    id: value.id,
    authorName: value.authorName,
    authorHandle: value.authorHandle,
    text: value.text,
    mediaType: value.mediaType,
    media: parsedMedia.value,
  };

  for (const field of optionalStringFields) {
    const fieldValue = value[field];
    if (typeof fieldValue === "string") {
      post[field] = fieldValue;
    }
  }

  for (const field of optionalCountFields) {
    const fieldValue = value[field];
    if (isFiniteNumber(fieldValue)) {
      post[field] = Math.max(0, fieldValue);
    }
  }

  if (Array.isArray(value.tags)) {
    post.tags = value.tags.filter((tag): tag is string => typeof tag === "string");
  }
  if (isFiniteNumber(value.displaySeed)) {
    post.displaySeed = value.displaySeed;
  }

  return { ok: true, value: post };
}

export function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex];
  }

  return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
}

export function completeMissingPostValues(
  posts: readonly PostRecord[],
): PostRecord[] {
  const knownViewCounts = posts.flatMap((post) =>
    post.viewCount === undefined ? [] : [post.viewCount],
  );
  const medianViewCount = calculateMedian(knownViewCounts);

  return posts.map((post) => ({
    ...post,
    authorIconSrc:
      post.authorIconSrc === undefined
        ? APP_CONFIG.data.defaultAuthorIconSrc
        : resolvePublicUrl(post.authorIconSrc),
    media: post.media.map((media) => ({
      ...media,
      src: resolvePublicUrl(media.src),
      ...(media.thumbnailSrc === undefined
        ? {}
        : { thumbnailSrc: resolvePublicUrl(media.thumbnailSrc) }),
    })),
    viewCount: post.viewCount ?? medianViewCount,
    likeCount: post.likeCount ?? 0,
  }));
}

export function validatePosts(value: unknown): PostValidationResult {
  if (!Array.isArray(value)) {
    return {
      posts: [],
      issues: [
        {
          code: "invalid-root",
          index: null,
          message: "投稿データのルートは配列である必要があります。",
        },
      ],
    };
  }

  const posts: PostRecord[] = [];
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  value.forEach((candidate, index) => {
    const parsedPost = parsePost(candidate);
    const candidateId =
      isRecord(candidate) && typeof candidate.id === "string"
        ? candidate.id
        : undefined;

    if (!parsedPost.ok) {
      issues.push({
        code: "invalid-record",
        index,
        id: candidateId,
        message: parsedPost.message,
      });
      return;
    }

    if (seenIds.has(parsedPost.value.id)) {
      issues.push({
        code: "duplicate-id",
        index,
        id: parsedPost.value.id,
        message: `重複したid「${parsedPost.value.id}」を除外しました。`,
      });
      return;
    }

    seenIds.add(parsedPost.value.id);
    posts.push(parsedPost.value);
  });

  return {
    posts: completeMissingPostValues(posts),
    issues,
  };
}
