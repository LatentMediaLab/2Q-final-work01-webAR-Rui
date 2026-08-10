import { APP_CONFIG } from "../app/config";

export interface FallbackTransform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotation: number;
}

export interface GesturePoint {
  readonly x: number;
  readonly y: number;
}

export interface GestureMetrics {
  readonly centerX: number;
  readonly centerY: number;
  readonly distance: number;
  readonly angle: number;
}

export const DEFAULT_FALLBACK_TRANSFORM: FallbackTransform = {
  x: 0,
  y: 0,
  scale: APP_CONFIG.fallback.defaultScale,
  rotation: 0,
};

export function createGestureMetrics(
  points: readonly GesturePoint[],
): GestureMetrics | null {
  const first = points[0];
  if (first === undefined) {
    return null;
  }
  const second = points[1];
  if (second === undefined) {
    return {
      centerX: first.x,
      centerY: first.y,
      distance: 0,
      angle: 0,
    };
  }

  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  return {
    centerX: (first.x + second.x) / 2,
    centerY: (first.y + second.y) / 2,
    distance: Math.hypot(deltaX, deltaY),
    angle: Math.atan2(deltaY, deltaX),
  };
}

export function transformFromGesture(
  startTransform: FallbackTransform,
  startGesture: GestureMetrics,
  currentGesture: GestureMetrics,
  viewportWidth: number,
  viewportHeight: number,
): FallbackTransform {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const scaleRatio =
    startGesture.distance > 0 && currentGesture.distance > 0
      ? currentGesture.distance / startGesture.distance
      : 1;
  const rotationDelta =
    startGesture.distance > 0 && currentGesture.distance > 0
      ? normalizeAngle(currentGesture.angle - startGesture.angle)
      : 0;

  return clampFallbackTransform({
    x:
      startTransform.x +
      ((currentGesture.centerX - startGesture.centerX) / width) *
        APP_CONFIG.fallback.dragWorldWidth,
    y:
      startTransform.y -
      ((currentGesture.centerY - startGesture.centerY) / height) *
        APP_CONFIG.fallback.dragWorldHeight,
    scale: startTransform.scale * scaleRatio,
    rotation: normalizeAngle(startTransform.rotation - rotationDelta),
  });
}

export function clampFallbackTransform(
  transform: FallbackTransform,
): FallbackTransform {
  return {
    x: clamp(
      transform.x,
      -APP_CONFIG.fallback.maxPositionX,
      APP_CONFIG.fallback.maxPositionX,
    ),
    y: clamp(
      transform.y,
      -APP_CONFIG.fallback.maxPositionY,
      APP_CONFIG.fallback.maxPositionY,
    ),
    scale: clamp(
      transform.scale,
      APP_CONFIG.fallback.minScale,
      APP_CONFIG.fallback.maxScale,
    ),
    rotation: normalizeAngle(transform.rotation),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
