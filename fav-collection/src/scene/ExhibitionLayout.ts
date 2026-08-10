import { APP_CONFIG } from "../app/config";
import type { PostMediaType, PostRecord } from "../data/PostTypes";
import { createSeededRandom, hashStringToSeed } from "../utils/seededRandom";
import {
  getViewCountRange,
  mapNormalizedViewToScale,
  mapNormalizedViewToTextSpeed,
  normalizeViewCount,
} from "../utils/viewCount";
import {
  getScrollingTextMetrics,
  type ScrollingTextMetrics,
} from "./ScrollingTextMetrics";

export interface LayoutRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ExhibitionLayoutItem extends LayoutRectangle {
  readonly postId: string;
  readonly mediaType: PostMediaType;
  readonly z: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
  readonly normalizedViewCount: number;
  readonly scale: number;
  readonly textSpeed: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly mountDepth: number;
  readonly laneIndex?: number;
}

interface MutableDimensions {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
}

interface RankedPost {
  readonly post: PostRecord;
  readonly viewCount: number;
  readonly normalizedViewCount: number;
  readonly scale: number;
}

interface CandidatePosition {
  readonly x: number;
  readonly y: number;
}

interface DisplayPose {
  readonly z: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly mountDepth: number;
}

export function rectanglesOverlap(
  first: LayoutRectangle,
  second: LayoutRectangle,
  padding = 0,
): boolean {
  return (
    Math.abs(first.x - second.x) <
      (first.width + second.width) / 2 + padding &&
    Math.abs(first.y - second.y) <
      (first.height + second.height) / 2 + padding
  );
}

export function isRectangleInsideExhibition(rectangle: LayoutRectangle): boolean {
  const halfWidth = APP_CONFIG.exhibition.width / 2;
  const halfHeight = APP_CONFIG.exhibition.height / 2;
  const padding = APP_CONFIG.layout.padding;

  return (
    rectangle.x - rectangle.width / 2 >= -halfWidth + padding &&
    rectangle.x + rectangle.width / 2 <= halfWidth - padding &&
    rectangle.y - rectangle.height / 2 >= -halfHeight + padding &&
    rectangle.y + rectangle.height / 2 <= halfHeight - padding
  );
}

export function createExhibitionLayout(
  posts: readonly PostRecord[],
): ExhibitionLayoutItem[] {
  if (posts.length === 0) {
    return [];
  }

  const effectiveViewCounts = completeViewCounts(posts);
  const range = getViewCountRange([...effectiveViewCounts.values()]);
  const rankedPosts = posts.map<RankedPost>((post) => {
    const viewCount = effectiveViewCounts.get(post.id) ?? 0;
    const normalizedViewCount = normalizeViewCount(
      viewCount,
      range.min,
      range.max,
    );

    return {
      post,
      viewCount,
      normalizedViewCount,
      scale: mapNormalizedViewToScale(normalizedViewCount),
    };
  });

  const textPosts = rankedPosts.filter(({ post }) => post.mediaType === "text");
  const mediaPosts = rankedPosts
    .filter(({ post }) => post.mediaType !== "text")
    .sort(
      (first, second) =>
        second.viewCount - first.viewCount ||
        first.post.id.localeCompare(second.post.id),
  );

  const textLayouts = layoutTextPosts(textPosts);
  const mediaLayouts = layoutMediaPosts(mediaPosts);
  const layoutsByPostId = new Map(
    [...textLayouts, ...mediaLayouts].map((layout) => [layout.postId, layout]),
  );

  return posts.flatMap((post) => {
    const layout = layoutsByPostId.get(post.id);
    return layout === undefined ? [] : [layout];
  });
}

function completeViewCounts(posts: readonly PostRecord[]): Map<string, number> {
  const knownValues = posts.flatMap((post) =>
    post.viewCount === undefined ? [] : [Math.max(0, post.viewCount)],
  );
  const median = calculateMedian(knownValues);

  return new Map(
    posts.map((post) => [
      post.id,
      post.viewCount === undefined ? median : Math.max(0, post.viewCount),
    ]),
  );
}

function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function layoutTextPosts(posts: readonly RankedPost[]): ExhibitionLayoutItem[] {
  if (posts.length === 0) {
    return [];
  }

  const textMetrics = posts.map(({ post }) =>
    getScrollingTextMetrics(post.authorHandle, post.text),
  );
  const laneCount = getTextLaneCount(textMetrics);
  const laneHeights = getTextLaneHeights(textMetrics, laneCount);
  const laneCenters = getLaneCenters(laneHeights);
  const postsPerLane = new Map<number, number>();
  const assignedPerLane = new Map<number, number>();

  posts.forEach((_post, index) => {
    const laneIndex = index % laneCount;
    postsPerLane.set(laneIndex, (postsPerLane.get(laneIndex) ?? 0) + 1);
  });

  return posts.map((rankedPost, index) => {
    const laneIndex = index % laneCount;
    const assignedIndex = assignedPerLane.get(laneIndex) ?? 0;
    const lanePostCount = postsPerLane.get(laneIndex) ?? 1;
    assignedPerLane.set(laneIndex, assignedIndex + 1);

    const metrics = textMetrics[index] ??
      getScrollingTextMetrics(
        rankedPost.post.authorHandle,
        rankedPost.post.text,
      );
    const panelWidth = metrics.width;
    const usableWidth = Math.max(
      0,
      APP_CONFIG.exhibition.width -
        Math.min(panelWidth, APP_CONFIG.exhibition.width) -
        APP_CONFIG.layout.padding * 2,
    );
    const x =
      lanePostCount === 1
        ? 0
        : -usableWidth / 2 +
          (usableWidth * assignedIndex) / Math.max(1, lanePostCount - 1);
    const seed = getPostSeed(rankedPost.post);
    const pose = createDisplayPose(
      "text",
      rankedPost.normalizedViewCount,
      seed,
    );

    return {
      postId: rankedPost.post.id,
      mediaType: "text",
      x,
      y: laneCenters[laneIndex] ?? 0,
      ...pose,
      width: panelWidth,
      height: metrics.height,
      contentWidth: panelWidth,
      contentHeight: metrics.height,
      normalizedViewCount: rankedPost.normalizedViewCount,
      scale: rankedPost.scale,
      textSpeed: mapNormalizedViewToTextSpeed(
        rankedPost.normalizedViewCount,
      ),
      laneIndex,
    };
  });
}

function getTextLaneCount(
  textMetrics: readonly ScrollingTextMetrics[],
): number {
  const maximumLaneCount = Math.min(
    APP_CONFIG.layout.textLaneCount,
    textMetrics.length,
  );
  const availableHeight =
    APP_CONFIG.exhibition.height - APP_CONFIG.layout.padding * 2;

  for (let laneCount = maximumLaneCount; laneCount > 1; laneCount -= 1) {
    const laneHeights = getTextLaneHeights(textMetrics, laneCount);
    const occupiedHeight =
      laneHeights.reduce((total, height) => total + height, 0) +
      APP_CONFIG.layout.padding * (laneCount - 1);
    if (occupiedHeight <= availableHeight) {
      return laneCount;
    }
  }

  return 1;
}

function getTextLaneHeights(
  textMetrics: readonly ScrollingTextMetrics[],
  laneCount: number,
): number[] {
  const laneHeights = Array.from({ length: laneCount }, () => 0);
  textMetrics.forEach((metrics, index) => {
    const laneIndex = index % laneCount;
    laneHeights[laneIndex] = Math.max(
      laneHeights[laneIndex] ?? 0,
      metrics.height,
    );
  });
  return laneHeights;
}

function getLaneCenters(laneHeights: readonly number[]): number[] {
  if (laneHeights.length === 0) {
    return [];
  }

  const centers = Array.from({ length: laneHeights.length }, () => 0);
  const sortedLaneIndexes = laneHeights
    .map((_height, index) => index)
    .sort(
      (first, second) =>
        (laneHeights[second] ?? 0) - (laneHeights[first] ?? 0) ||
        first - second,
    );
  const edge =
    APP_CONFIG.exhibition.height / 2 - APP_CONFIG.layout.padding;
  let topUsedHeight = 0;
  let bottomUsedHeight = 0;

  sortedLaneIndexes.forEach((laneIndex) => {
    const height = laneHeights[laneIndex] ?? 0;
    if (topUsedHeight <= bottomUsedHeight) {
      centers[laneIndex] = edge - topUsedHeight - height / 2;
      topUsedHeight += height + APP_CONFIG.layout.padding;
      return;
    }

    centers[laneIndex] = -edge + bottomUsedHeight + height / 2;
    bottomUsedHeight += height + APP_CONFIG.layout.padding;
  });

  return centers;
}

function layoutMediaPosts(
  posts: readonly RankedPost[],
): ExhibitionLayoutItem[] {
  const occupied: LayoutRectangle[] = [];
  const layouts: ExhibitionLayoutItem[] = [];

  for (const rankedPost of posts) {
    const seed = getPostSeed(rankedPost.post);
    const dimensions = getMediaDimensions(
      rankedPost.post,
      rankedPost.scale,
      seed,
    );
    const random = createSeededRandom(seed);
    const candidate = findPlacement(
      dimensions,
      rankedPost.normalizedViewCount,
      occupied,
      random,
      createClusterBias(seed, rankedPost.normalizedViewCount),
    );
    const rectangle: LayoutRectangle = {
      x: candidate.position.x,
      y: candidate.position.y,
      width: candidate.dimensions.width,
      height: candidate.dimensions.height,
    };
    occupied.push(rectangle);
    const pose = createDisplayPose(
      rankedPost.post.mediaType,
      rankedPost.normalizedViewCount,
      seed,
    );

    layouts.push({
      postId: rankedPost.post.id,
      mediaType: rankedPost.post.mediaType,
      ...rectangle,
      ...pose,
      contentWidth: candidate.dimensions.contentWidth,
      contentHeight: candidate.dimensions.contentHeight,
      normalizedViewCount: rankedPost.normalizedViewCount,
      scale: rankedPost.scale,
      textSpeed: mapNormalizedViewToTextSpeed(
        rankedPost.normalizedViewCount,
      ),
    });
  }

  return layouts;
}

function getMediaDimensions(
  post: PostRecord,
  scale: number,
  seed: number,
): MutableDimensions {
  const aspect = getMediaAspect(post);
  const variationRandom = createSeededRandom(seed ^ 0x9e3779b9);
  const sizeVariation =
    APP_CONFIG.layout.mediaSizeVariationMin +
    (APP_CONFIG.layout.mediaSizeVariationMax -
      APP_CONFIG.layout.mediaSizeVariationMin) *
      variationRandom();
  let contentWidth =
    APP_CONFIG.layout.mediaBaseSize * scale * sizeVariation * Math.sqrt(aspect);
  let contentHeight =
    (APP_CONFIG.layout.mediaBaseSize * scale * sizeVariation) /
    Math.sqrt(aspect);
  const fitScale = Math.min(
    1,
    APP_CONFIG.layout.mediaMaxWidth / contentWidth,
    APP_CONFIG.layout.mediaMaxHeight / contentHeight,
  );
  contentWidth *= fitScale;
  contentHeight *= fitScale;

  return {
    contentWidth,
    contentHeight,
    width: contentWidth + APP_CONFIG.layout.frameMargin * 2,
    height:
      contentHeight +
      APP_CONFIG.layout.frameMargin * 2 +
      APP_CONFIG.layout.captionHeight,
  };
}

function getMediaAspect(post: PostRecord): number {
  const media = post.media[0];
  if (media === undefined) {
    return 1;
  }

  const width = media.width ?? 1;
  const height = media.height ?? 1;
  if (width <= 0 || height <= 0) {
    return 1;
  }

  return Math.max(0.05, Math.min(20, width / height));
}

function findPlacement(
  initialDimensions: MutableDimensions,
  normalizedViewCount: number,
  occupied: readonly LayoutRectangle[],
  random: () => number,
  clusterBias: CandidatePosition,
): { position: CandidatePosition; dimensions: MutableDimensions } {
  let dimensions = { ...initialDimensions };

  for (let shrinkAttempt = 0; shrinkAttempt < 7; shrinkAttempt += 1) {
    for (
      let attempt = 0;
      attempt < APP_CONFIG.layout.maxPlacementAttempts;
      attempt += 1
    ) {
      const position = createRadialCandidate(
        dimensions,
        normalizedViewCount,
        random,
        clusterBias,
      );
      const rectangle = { ...position, ...dimensions };
      if (canPlace(rectangle, occupied)) {
        return { position, dimensions };
      }
    }

    const fallback = findGridFallback(
      dimensions,
      normalizedViewCount,
      occupied,
    );
    if (fallback !== undefined) {
      return { position: fallback, dimensions };
    }

    dimensions = scaleDimensions(dimensions, 0.9);
  }

  return {
    position: findLowestOverlapPosition(
      dimensions,
      normalizedViewCount,
      occupied,
    ),
    dimensions,
  };
}

function createRadialCandidate(
  dimensions: MutableDimensions,
  normalizedViewCount: number,
  random: () => number,
  clusterBias: CandidatePosition,
): CandidatePosition {
  const xLimit = getHorizontalLimit(dimensions.width);
  const yLimit = getVerticalLimit(dimensions.height);
  const desiredRadius = 1 - normalizedViewCount;
  const radius = Math.min(
    1,
    Math.max(0, desiredRadius + (random() - 0.5) * 0.42),
  );
  const angle = random() * Math.PI * 2;

  return {
    x: clamp(
      Math.cos(angle) * xLimit * radius + clusterBias.x * xLimit,
      -xLimit,
      xLimit,
    ),
    y: clamp(
      Math.sin(angle) * yLimit * radius + clusterBias.y * yLimit,
      -yLimit,
      yLimit,
    ),
  };
}

function getPostSeed(post: PostRecord): number {
  return (
    (post.displaySeed ?? hashStringToSeed(post.id)) ^
    APP_CONFIG.layout.globalSeed
  ) >>> 0;
}

function createClusterBias(
  seed: number,
  normalizedViewCount: number,
): CandidatePosition {
  const random = createSeededRandom(seed ^ 0x85ebca6b);
  const clusterAngle = Math.floor(random() * 5) * ((Math.PI * 2) / 5);
  const strength =
    APP_CONFIG.layout.clusterBias * (1 - normalizedViewCount * 0.72);
  return {
    x: Math.cos(clusterAngle) * strength,
    y: Math.sin(clusterAngle) * strength,
  };
}

function createDisplayPose(
  mediaType: PostMediaType,
  normalizedViewCount: number,
  seed: number,
): DisplayPose {
  const random = createSeededRandom(seed ^ 0xc2b2ae35);
  const tilt =
    mediaType === "text"
      ? APP_CONFIG.layout.textTiltDegrees
      : APP_CONFIG.layout.mediaTiltDegrees;
  const depthVariation = 0.18 + random() * 0.46;
  const depthRatio = clamp(
    normalizedViewCount * 0.58 + depthVariation,
    0,
    1,
  );
  const mountDepthMin =
    mediaType === "text"
      ? APP_CONFIG.layout.textMountDepthMin
      : APP_CONFIG.layout.mediaMountDepthMin;
  const mountDepthMax =
    mediaType === "text"
      ? APP_CONFIG.layout.textMountDepthMax
      : APP_CONFIG.layout.mediaMountDepthMax;

  return {
    z:
      mediaType === "text"
        ? APP_CONFIG.exhibition.wallOffset
        : APP_CONFIG.exhibition.wallOffset +
          depthRatio * APP_CONFIG.exhibition.maxDepthOffset,
    rotationX: centeredRandom(random) * degreesToRadians(tilt.x),
    rotationY: centeredRandom(random) * degreesToRadians(tilt.y),
    rotationZ: centeredRandom(random) * degreesToRadians(tilt.z),
    mountDepth: mountDepthMin + (mountDepthMax - mountDepthMin) * random(),
  };
}

function centeredRandom(random: () => number): number {
  return random() * 2 - 1;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function findGridFallback(
  dimensions: MutableDimensions,
  normalizedViewCount: number,
  occupied: readonly LayoutRectangle[],
): CandidatePosition | undefined {
  return getGridCandidates(dimensions, normalizedViewCount).find((position) =>
    canPlace({ ...position, ...dimensions }, occupied),
  );
}

function findLowestOverlapPosition(
  dimensions: MutableDimensions,
  normalizedViewCount: number,
  occupied: readonly LayoutRectangle[],
): CandidatePosition {
  const candidates = getGridCandidates(dimensions, normalizedViewCount);
  let bestPosition = candidates[0] ?? { x: 0, y: 0 };
  let bestOverlap = Number.POSITIVE_INFINITY;

  for (const position of candidates) {
    const rectangle = { ...position, ...dimensions };
    const overlap = occupied.reduce(
      (sum, other) => sum + getOverlapArea(rectangle, other),
      0,
    );
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestPosition = position;
    }
  }

  return bestPosition;
}

function getGridCandidates(
  dimensions: MutableDimensions,
  normalizedViewCount: number,
): CandidatePosition[] {
  const xLimit = getHorizontalLimit(dimensions.width);
  const yLimit = getVerticalLimit(dimensions.height);
  const step = APP_CONFIG.layout.fallbackGridStep;
  const desiredRadius = 1 - normalizedViewCount;
  const candidates: Array<CandidatePosition & { readonly score: number }> = [];

  for (let y = -yLimit; y <= yLimit + step / 2; y += step) {
    for (let x = -xLimit; x <= xLimit + step / 2; x += step) {
      const normalizedX = xLimit === 0 ? 0 : x / xLimit;
      const normalizedY = yLimit === 0 ? 0 : y / yLimit;
      const radius = Math.min(1, Math.hypot(normalizedX, normalizedY));
      candidates.push({
        x: roundCoordinate(x),
        y: roundCoordinate(y),
        score: Math.abs(radius - desiredRadius),
      });
    }
  }

  return candidates
    .sort(
      (first, second) =>
        first.score - second.score || first.y - second.y || first.x - second.x,
    )
    .map(({ x, y }) => ({ x, y }));
}

function getHorizontalLimit(width: number): number {
  return Math.max(
    0,
    (APP_CONFIG.exhibition.width - width) / 2 - APP_CONFIG.layout.padding,
  );
}

function getVerticalLimit(height: number): number {
  return Math.max(
    0,
    (APP_CONFIG.exhibition.height - height) / 2 - APP_CONFIG.layout.padding,
  );
}

function canPlace(
  rectangle: LayoutRectangle,
  occupied: readonly LayoutRectangle[],
): boolean {
  return (
    isRectangleInsideExhibition(rectangle) &&
    occupied.every(
      (other) =>
        !rectanglesOverlap(
          rectangle,
          other,
          APP_CONFIG.layout.collisionPadding,
        ),
    )
  );
}

function scaleDimensions(
  dimensions: MutableDimensions,
  scale: number,
): MutableDimensions {
  return {
    width: dimensions.width * scale,
    height: dimensions.height * scale,
    contentWidth: dimensions.contentWidth * scale,
    contentHeight: dimensions.contentHeight * scale,
  };
}

function getOverlapArea(
  first: LayoutRectangle,
  second: LayoutRectangle,
): number {
  const overlapWidth = Math.max(
    0,
    (first.width + second.width) / 2 - Math.abs(first.x - second.x),
  );
  const overlapHeight = Math.max(
    0,
    (first.height + second.height) / 2 - Math.abs(first.y - second.y),
  );
  return overlapWidth * overlapHeight;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
