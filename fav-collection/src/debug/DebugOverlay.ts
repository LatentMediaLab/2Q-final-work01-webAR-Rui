import type { AppMode } from "../app/AppState";
import type { ArPlacementState } from "../ar/ArState";
import type { WebXRSupportStatus } from "../ar/WebXRSupport";
import type { FallbackPlacementState } from "../ar/FallbackState";

export interface DebugSnapshot {
  readonly postCount: number;
  readonly appMode: AppMode;
  readonly xrSupport: WebXRSupportStatus;
  readonly arPlacement: ArPlacementState;
  readonly fallbackPlacement: FallbackPlacementState;
  readonly selectedPostId: string | null;
  readonly playingVideoId: string | null;
  readonly detailReturnMode: "preview" | "placed" | "fallback" | null;
}

export class FrameRateMeter {
  private frameCount = 0;
  private sampleStartedAt: number | null = null;
  private fps = 0;

  public recordFrame(now: number): number {
    this.sampleStartedAt ??= now;
    this.frameCount += 1;
    const elapsed = now - this.sampleStartedAt;
    if (elapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1_000) / elapsed);
      this.frameCount = 0;
      this.sampleStartedAt = now;
    }
    return this.fps;
  }
}

export class DebugOverlay {
  private readonly element: HTMLElement;
  private readonly meter = new FrameRateMeter();
  private snapshot: DebugSnapshot;
  private animationFrameId: number | null = null;
  private lastRenderedFps = -1;
  private disposed = false;

  public constructor(container: HTMLElement, initialSnapshot: DebugSnapshot) {
    this.snapshot = initialSnapshot;
    this.element = document.createElement("aside");
    this.element.className = "debug-overlay";
    this.element.setAttribute("aria-hidden", "true");
    container.append(this.element);
    this.render(0);
    this.animationFrameId = requestAnimationFrame(this.handleFrame);
  }

  public update(snapshot: DebugSnapshot): void {
    this.snapshot = snapshot;
    this.render(this.lastRenderedFps < 0 ? 0 : this.lastRenderedFps);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.element.remove();
  }

  private readonly handleFrame = (now: number): void => {
    if (this.disposed) {
      return;
    }
    const fps = this.meter.recordFrame(now);
    if (fps !== this.lastRenderedFps) {
      this.lastRenderedFps = fps;
      this.render(fps);
    }
    this.animationFrameId = requestAnimationFrame(this.handleFrame);
  };

  private render(fps: number): void {
    const hitTest = getHitTestStatus(this.snapshot);
    const placement = getPlacementStatus(this.snapshot);
    this.element.textContent = [
      `FPS: ${fps}`,
      `投稿数: ${this.snapshot.postCount}`,
      `AppMode: ${this.snapshot.appMode}`,
      `WebXR: ${this.snapshot.xrSupport}`,
      `Hit Test: ${hitTest}`,
      `展示: ${placement}`,
      `選択: ${this.snapshot.selectedPostId ?? "なし"}`,
      `動画: ${this.snapshot.playingVideoId ?? "なし"}`,
    ].join("\n");
  }
}

function getHitTestStatus(snapshot: DebugSnapshot): string {
  const xrDetail =
    snapshot.appMode === "detail" && snapshot.detailReturnMode === "placed";
  if (
    snapshot.appMode !== "scanning" &&
    snapshot.appMode !== "placed" &&
    !xrDetail
  ) {
    return "対象外";
  }
  const state = snapshot.arPlacement;
  switch (state) {
    case "loading":
      return "待機中";
    case "scanning":
      return "探索中";
    case "ready":
      return "検出";
    case "placed":
      return "完了";
  }
}

function getPlacementStatus(snapshot: DebugSnapshot): string {
  if (snapshot.appMode === "fallback") {
    return snapshot.fallbackPlacement;
  }
  if (snapshot.arPlacement === "placed") {
    return "配置済み";
  }
  return "未配置";
}
