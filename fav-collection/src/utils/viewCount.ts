import { APP_CONFIG } from "../app/config";

export interface ViewCountRange {
  readonly min: number;
  readonly max: number;
}

export function getViewCountRange(values: readonly number[]): ViewCountRange {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  const safeValues = values.map((value) => Math.max(0, value));
  return {
    min: Math.min(...safeValues),
    max: Math.max(...safeValues),
  };
}

export function normalizeViewCount(
  viewCount: number,
  minViewCount: number,
  maxViewCount: number,
): number {
  const safeValue = Math.max(0, viewCount);
  const safeMin = Math.max(0, minViewCount);
  const safeMax = Math.max(safeMin, maxViewCount);

  if (safeMax === safeMin) {
    return 0.5;
  }

  const denominator = Math.log1p(safeMax) - Math.log1p(safeMin);
  if (denominator <= 0) {
    return 0.5;
  }

  const normalized =
    (Math.log1p(safeValue) - Math.log1p(safeMin)) / denominator;
  return Math.min(1, Math.max(0, normalized));
}

export function mapNormalizedViewToScale(normalized: number): number {
  return interpolateClamped(
    normalized,
    APP_CONFIG.scale.min,
    APP_CONFIG.scale.max,
  );
}

export function mapViewCountToScale(
  viewCount: number,
  minViewCount: number,
  maxViewCount: number,
): number {
  return mapNormalizedViewToScale(
    normalizeViewCount(viewCount, minViewCount, maxViewCount),
  );
}

function interpolateClamped(
  normalized: number,
  minimum: number,
  maximum: number,
): number {
  const clamped = Math.min(1, Math.max(0, normalized));
  return minimum + (maximum - minimum) * clamped;
}
