import { APP_CONFIG } from "../app/config";

export function getRendererPixelRatio(devicePixelRatio: number): number {
  const safeRatio = Number.isFinite(devicePixelRatio)
    ? Math.max(1, devicePixelRatio)
    : 1;
  return Math.min(safeRatio, APP_CONFIG.performance.maxPixelRatio);
}

export function shouldUseAntialias(devicePixelRatio: number): boolean {
  return devicePixelRatio <= APP_CONFIG.performance.antialiasMaxPixelRatio;
}
