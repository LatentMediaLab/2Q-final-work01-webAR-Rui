import type { PreviewUiState } from "../app/PreviewState";
import { getArInstruction, type ArPlacementState } from "../ar/ArState";
import type {
  FallbackPlacementState,
  FallbackTrackingMode,
} from "../ar/FallbackState";
import type { PostRecord } from "../data/PostTypes";
import { ExclusiveVideoController } from "../interaction/ExclusiveVideoController";
import { formatPostDetail, type PostDetailModel } from "./PostDetailModel";
import {
  getMediaLoadErrorMessage,
  getMediaPlaceholderSource,
  getVideoPlaybackErrorMessage,
} from "./MediaStatus";
import { APP_CONFIG } from "../app/config";

interface PreviewViewOptions {
  readonly postCount: number;
  readonly onBack: () => void;
  readonly onCloseDetail: () => void;
  readonly onOpenSettings: () => void;
  readonly onCloseSettings: () => void;
  readonly onOpenInfo: () => void;
  readonly onCloseInfo: () => void;
  readonly onToggleTextAnimation: () => void;
  readonly onStopVideos: () => void;
  readonly onPlayingVideoChange?: (postId: string | null) => void;
  readonly onToggleCaptions: () => void;
  readonly onResetCamera: () => void;
  readonly experience?: "preview" | "ar" | "fallback";
  readonly onExitAr?: () => void;
  readonly onReposition?: () => void;
  readonly onExitFallback?: () => void;
  readonly onPlaceFallbackWall?: () => void;
  readonly onResetFallback?: () => void;
  readonly onResetFallbackWall?: () => void;
  readonly onToggleFallbackAdjustment?: () => void;
}

export interface PreviewViewController {
  readonly viewport: HTMLElement;
  readonly overlayRoot: HTMLElement;
  updateUi(state: PreviewUiState): void;
  updateArState(state: ArPlacementState): void;
  updateFallbackState(
    state: FallbackPlacementState,
    trackingMode: FallbackTrackingMode | null,
  ): void;
  updatePostCount(count: number): void;
  showDetail(post: PostRecord): void;
  hideDetail(): void;
  stopAllVideos(): void;
  dispose(): void;
}

export function renderPreviewView(
  container: HTMLElement,
  options: PreviewViewOptions,
): PreviewViewController {
  const isAr = options.experience === "ar";
  const isFallback = options.experience === "fallback";
  const navigation = isAr
    ? `
          <button class="preview-control" type="button" data-action="info">作品説明</button>
          <button class="preview-control" type="button" data-action="settings">設定</button>
          <button class="preview-control" type="button" data-action="exit-ar">ARを終了</button>`
    : isFallback
      ? `
          <button class="preview-control" type="button" data-action="info">説明</button>
          <button class="preview-control" type="button" data-action="settings">設定</button>
          <button class="preview-control" type="button" data-action="exit-fallback">終了</button>`
      : `
          <button class="preview-control" type="button" data-action="info">作品説明</button>
          <button class="preview-control" type="button" data-action="settings">設定</button>
          <button class="preview-control" type="button" data-action="back">最初の画面へ</button>`;
  const fourthSetting = isAr
    ? '<button class="settings-button" type="button" data-action="reposition" disabled>展示を再配置</button>'
    : isFallback
      ? ""
      : '<button class="settings-button" type="button" data-action="reset-camera">カメラ位置をリセット</button>';
  const arStatus = isAr
    ? `
      <section class="ar-status preview-ui-layer" data-preview-ui data-ar-status data-state="loading" role="status" aria-live="polite">
        <span class="ar-status-symbol" aria-hidden="true"><span></span></span>
        <p data-ar-instruction>${getArInstruction("loading")}</p>
      </section>`
    : "";
  const fallbackControls = isFallback
    ? `
      <section class="fallback-controls preview-ui-layer" data-preview-ui data-fallback-controls aria-label="簡易ARの壁面設定">
        <p data-fallback-instruction role="status" aria-live="polite">壁を正面に捉え、画面の枠を壁面へ合わせてください。</p>
        <div>
          <button class="preview-control" type="button" data-action="place-fallback-wall">この壁面に展示する</button>
          <button class="preview-control" type="button" data-action="toggle-fallback-adjustment" hidden>展示を調整</button>
          <button class="preview-control" type="button" data-action="reset-fallback" hidden>表示位置を戻す</button>
          <button class="preview-control" type="button" data-action="reset-fallback-wall" hidden>壁面を設定し直す</button>
        </div>
      </section>
      <div class="fallback-wall-target" data-fallback-wall-target aria-hidden="true">
        <span></span><span></span><span></span><span></span>
        <p>WALL AREA</p>
      </div>`
    : "";
  container.innerHTML = `
    <main class="preview-shell${isAr ? " ar-shell" : ""}${isFallback ? " fallback-shell" : ""}" data-overlay-root${isFallback ? ' data-fallback-state="aiming"' : ""}>
      <div class="preview-viewport" data-preview-viewport></div>
      <header class="preview-hud preview-ui-layer" data-preview-ui>
        <div>
          <p class="preview-label">${isAr ? "WEBXR AR" : isFallback ? "簡易ARモード" : "NORMAL PREVIEW"}</p>
          <p class="preview-count" aria-live="polite"></p>
        </div>
        <nav class="preview-nav" aria-label="プレビュー操作">
          ${navigation}
        </nav>
      </header>

      <section class="settings-panel preview-ui-layer" data-preview-ui data-settings-panel hidden role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="panel-heading">
          <div>
            <p class="preview-label">DISPLAY SETTINGS</p>
            <h2 id="settings-title">表示設定</h2>
          </div>
          <button class="icon-button" type="button" data-action="close-settings" aria-label="表示設定を閉じる">閉じる</button>
        </header>
        <div class="settings-actions">
          <button class="settings-button" type="button" data-action="toggle-text"></button>
          <button class="settings-button" type="button" data-action="stop-videos">動画をすべて停止</button>
          <button class="settings-button" type="button" data-action="toggle-captions"></button>
          ${fourthSetting}
        </div>
      </section>

      <section class="info-overlay preview-ui-layer" data-preview-ui data-info-overlay hidden role="dialog" aria-modal="true" aria-labelledby="info-title">
        <article class="info-card">
          <p class="preview-label">ABOUT THE WORK</p>
          <h2 id="info-title">驚異の部屋-私のSNS コレクション- : SNS 投稿の展示空間上への再配置による鑑賞体験の考察</h2>
          <p>Xで「いいね」した投稿を、個人的なコレクションとして壁面へ再配置する作品です。</p>
          <p>画像は額装作品、動画は映像展示、テキストは流れる言葉として、タイムラインとは異なる距離から眺められます。</p>
          <button class="settings-button" type="button" data-action="close-info">作品説明を閉じる</button>
        </article>
      </section>

      <section class="detail-layer preview-ui-layer" data-preview-ui data-detail-layer hidden>
        <article class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <header class="panel-heading detail-heading">
            <p class="preview-label">COLLECTION DETAIL</p>
            <button class="icon-button" type="button" data-action="close-detail" aria-label="投稿詳細を閉じる">閉じる</button>
          </header>
          <div data-detail-content></div>
        </article>
      </section>

      ${arStatus}
      ${fallbackControls}
      <p class="preview-help">${isAr ? "画面の案内に従って壁面へ配置してください" : isFallback ? "簡易ARは端末の向きと手動操作で壁面表示を近似します。正確な空間固定ではありません。" : "クリックまたはタップで投稿を選択・ドラッグで回転・ホイールまたはピンチで拡大縮小"}</p>
    </main>
  `;

  const viewport = requireElement<HTMLElement>(container, "[data-preview-viewport]");
  const postCount = requireElement<HTMLElement>(container, ".preview-count");
  postCount.textContent = isAr
    ? `${options.postCount}件の投稿をARで配置`
    : isFallback
      ? `${options.postCount}件の投稿を簡易表示`
      : `${options.postCount}件の投稿を展示中`;

  const controller = new DomPreviewViewController(container, viewport, options);
  return controller;
}

class DomPreviewViewController implements PreviewViewController {
  private readonly detailLayer: HTMLElement;
  private readonly detailContent: HTMLElement;
  private readonly settingsPanel: HTMLElement;
  private readonly infoOverlay: HTMLElement;
  private readonly toggleTextButton: HTMLButtonElement;
  private readonly toggleCaptionsButton: HTMLButtonElement;
  private readonly closeDetailButton: HTMLButtonElement;
  private readonly closeSettingsButton: HTMLButtonElement;
  private readonly closeInfoButton: HTMLButtonElement;
  public readonly overlayRoot: HTMLElement;
  private readonly arStatus: HTMLElement | null;
  private readonly arInstruction: HTMLElement | null;
  private readonly repositionButton: HTMLButtonElement | null;
  private readonly fallbackInstruction: HTMLElement | null;
  private readonly fallbackControls: HTMLElement | null;
  private readonly fallbackWallTarget: HTMLElement | null;
  private readonly fallbackPlaceButton: HTMLButtonElement | null;
  private readonly fallbackAdjustmentButton: HTMLButtonElement | null;
  private readonly fallbackResetButton: HTMLButtonElement | null;
  private readonly fallbackResetWallButton: HTMLButtonElement | null;
  private readonly postCount: HTMLElement;
  private readonly experience: "preview" | "ar" | "fallback";
  private readonly videoController = new ExclusiveVideoController();
  private detailVideo: HTMLVideoElement | null = null;
  private detailVideoButton: HTMLButtonElement | null = null;
  private detailVideoStatus: HTMLElement | null = null;
  private currentState: PreviewUiState | null = null;
  private settingsReturnFocus: HTMLElement | null = null;
  private infoReturnFocus: HTMLElement | null = null;
  private detailReturnFocus: HTMLElement | null = null;
  private disposed = false;

  public constructor(
    private readonly container: HTMLElement,
    public readonly viewport: HTMLElement,
    private readonly options: PreviewViewOptions,
  ) {
    this.experience = options.experience ?? "preview";
    this.overlayRoot = requireElement(container, "[data-overlay-root]");
    this.postCount = requireElement(container, ".preview-count");
    this.detailLayer = requireElement(container, "[data-detail-layer]");
    this.detailContent = requireElement(container, "[data-detail-content]");
    this.settingsPanel = requireElement(container, "[data-settings-panel]");
    this.infoOverlay = requireElement(container, "[data-info-overlay]");
    this.toggleTextButton = requireElement(container, '[data-action="toggle-text"]');
    this.toggleCaptionsButton = requireElement(
      container,
      '[data-action="toggle-captions"]',
    );
    this.closeDetailButton = requireElement(
      container,
      '[data-action="close-detail"]',
    );
    this.closeSettingsButton = requireElement(
      container,
      '[data-action="close-settings"]',
    );
    this.closeInfoButton = requireElement(
      container,
      '[data-action="close-info"]',
    );
    this.arStatus = container.querySelector("[data-ar-status]");
    this.arInstruction = container.querySelector("[data-ar-instruction]");
    this.repositionButton = container.querySelector('[data-action="reposition"]');
    this.fallbackInstruction = container.querySelector(
      "[data-fallback-instruction]",
    );
    this.fallbackControls = container.querySelector("[data-fallback-controls]");
    this.fallbackWallTarget = container.querySelector("[data-fallback-wall-target]");
    this.fallbackPlaceButton = container.querySelector(
      '[data-action="place-fallback-wall"]',
    );
    this.fallbackAdjustmentButton = container.querySelector(
      '[data-action="toggle-fallback-adjustment"]',
    );
    this.fallbackResetButton = container.querySelector(
      '[data-action="reset-fallback"]',
    );
    this.fallbackResetWallButton = container.querySelector(
      '[data-action="reset-fallback-wall"]',
    );

    this.bindOptionalButton("back", options.onBack);
    this.bindOptionalButton("exit-ar", options.onExitAr);
    this.bindOptionalButton("reposition", options.onReposition);
    this.bindOptionalButton("exit-fallback", options.onExitFallback);
    this.bindOptionalButton("place-fallback-wall", options.onPlaceFallbackWall);
    this.bindOptionalButton("reset-fallback", options.onResetFallback);
    this.bindOptionalButton(
      "reset-fallback-wall",
      options.onResetFallbackWall,
    );
    this.bindOptionalButton(
      "toggle-fallback-adjustment",
      options.onToggleFallbackAdjustment,
    );
    this.bindButton("close-detail", options.onCloseDetail);
    this.bindButton("settings", options.onOpenSettings);
    this.bindButton("close-settings", options.onCloseSettings);
    this.bindButton("info", options.onOpenInfo);
    this.bindButton("close-info", options.onCloseInfo);
    this.bindButton("toggle-text", options.onToggleTextAnimation);
    this.bindButton("stop-videos", options.onStopVideos);
    this.bindButton("toggle-captions", options.onToggleCaptions);
    this.bindOptionalButton("reset-camera", options.onResetCamera);

    container.querySelectorAll<HTMLElement>("[data-preview-ui]").forEach((layer) => {
      layer.addEventListener("pointerdown", stopPropagation);
      layer.addEventListener("pointerup", stopPropagation);
      layer.addEventListener("beforexrselect", preventXrSelect);
    });
    document.addEventListener("keydown", this.handleKeyDown);
  }

  public updateArState(state: ArPlacementState): void {
    if (this.arStatus === null || this.arInstruction === null) {
      return;
    }
    this.arStatus.dataset.state = state;
    this.arInstruction.textContent = getArInstruction(state);
    if (this.repositionButton !== null) {
      this.repositionButton.disabled = state !== "placed";
    }
  }

  public updatePostCount(count: number): void {
    this.postCount.textContent =
      this.experience === "ar"
        ? `${count}件の投稿をARで配置`
        : this.experience === "fallback"
          ? `${count}件の投稿を簡易表示`
          : `${count}件の投稿を展示中`;
  }

  public updateFallbackState(
    state: FallbackPlacementState,
    trackingMode: FallbackTrackingMode | null,
  ): void {
    if (
      this.fallbackInstruction === null ||
      this.fallbackPlaceButton === null ||
      this.fallbackAdjustmentButton === null ||
      this.fallbackResetButton === null ||
      this.fallbackResetWallButton === null
    ) {
      return;
    }
    this.overlayRoot.dataset.fallbackState = state;
    const aiming = state === "aiming" || state === "placing";
    const adjusting = state === "adjusting";
    this.fallbackPlaceButton.hidden = !aiming;
    this.fallbackPlaceButton.disabled = state === "placing";
    this.fallbackPlaceButton.textContent =
      state === "placing" ? "壁面を設定中…" : "この壁面に展示する";
    this.fallbackAdjustmentButton.hidden = aiming;
    this.fallbackAdjustmentButton.textContent = adjusting
      ? "調整を完了"
      : "展示を調整";
    this.fallbackAdjustmentButton.setAttribute(
      "aria-pressed",
      String(adjusting),
    );
    this.fallbackResetButton.hidden = !adjusting;
    this.fallbackResetWallButton.hidden = aiming;
    if (this.fallbackWallTarget !== null) {
      this.fallbackWallTarget.hidden = !aiming;
    }

    if (state === "aiming") {
      this.fallbackInstruction.textContent =
        "壁を正面に捉え、画面の枠を壁面へ合わせてください。";
    } else if (state === "placing") {
      this.fallbackInstruction.textContent = "壁面の向きを記録しています。";
    } else if (state === "adjusting") {
      this.fallbackInstruction.textContent =
        "一本指で移動、二本指で拡大・回転できます。";
    } else {
      this.fallbackInstruction.textContent =
        trackingMode === "orientation"
          ? "壁面を基準に表示中です。端末の向きを変えて一部ずつ鑑賞してください。"
          : "姿勢センサーを利用できないため、展示を調整して見える範囲を移動してください。";
    }
  }

  public updateUi(state: PreviewUiState): void {
    const previousState = this.currentState;
    this.currentState = state;
    this.settingsPanel.hidden = !state.settingsOpen;
    this.infoOverlay.hidden = !state.infoOpen;
    if (state.settingsOpen && !previousState?.settingsOpen) {
      this.settingsReturnFocus = getFocusedElement();
      this.closeSettingsButton.focus();
    } else if (!state.settingsOpen && previousState?.settingsOpen) {
      restoreFocus(this.settingsReturnFocus);
      this.settingsReturnFocus = null;
    }
    if (state.infoOpen && !previousState?.infoOpen) {
      this.infoReturnFocus = getFocusedElement();
      this.closeInfoButton.focus();
    } else if (!state.infoOpen && previousState?.infoOpen) {
      restoreFocus(this.infoReturnFocus);
      this.infoReturnFocus = null;
    }
    this.toggleTextButton.textContent = state.textAnimationPaused
      ? "テキスト移動を再開"
      : "テキスト移動を停止";
    this.toggleTextButton.setAttribute(
      "aria-pressed",
      String(state.textAnimationPaused),
    );
    this.toggleCaptionsButton.textContent = state.captionsVisible
      ? "キャプションを隠す"
      : "キャプションを表示";
    this.toggleCaptionsButton.setAttribute(
      "aria-pressed",
      String(!state.captionsVisible),
    );
  }

  public showDetail(post: PostRecord): void {
    if (this.detailLayer.hidden) {
      this.detailReturnFocus = getFocusedElement();
    }
    this.clearDetail();
    const model = formatPostDetail(post);
    this.detailContent.append(this.createDetailContent(model));
    this.detailLayer.hidden = false;
    if (this.fallbackControls !== null) {
      this.fallbackControls.hidden = true;
    }
    if (this.fallbackWallTarget !== null) {
      this.fallbackWallTarget.hidden = true;
    }
    this.closeDetailButton.focus();
  }

  public hideDetail(): void {
    if (this.detailLayer.hidden) {
      return;
    }
    this.detailLayer.hidden = true;
    if (this.fallbackControls !== null) {
      this.fallbackControls.hidden = false;
    }
    this.clearDetail();
    const returnFocus = this.detailReturnFocus;
    this.detailReturnFocus = null;
    if (returnFocus?.isConnected) {
      returnFocus.focus();
    } else {
      this.container.querySelector<HTMLCanvasElement>(".preview-canvas")?.focus();
    }
  }

  public stopAllVideos(): void {
    this.videoController.stopAll();
    this.options.onPlayingVideoChange?.(null);
    this.updateVideoControls(false, "すべての動画を停止しました。");
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearDetail();
    document.removeEventListener("keydown", this.handleKeyDown);
    this.container.querySelectorAll<HTMLElement>("[data-preview-ui]").forEach((layer) => {
      layer.removeEventListener("pointerdown", stopPropagation);
      layer.removeEventListener("pointerup", stopPropagation);
      layer.removeEventListener("beforexrselect", preventXrSelect);
    });
  }

  private createDetailContent(model: PostDetailModel): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const author = document.createElement("div");
    author.className = "detail-author";

    if (model.authorIconSrc !== undefined) {
      const icon = document.createElement("img");
      icon.className = "detail-author-icon";
      icon.src = model.authorIconSrc;
      icon.alt = "";
      icon.addEventListener("error", () => {
        if (icon.src.endsWith(APP_CONFIG.data.defaultAuthorIconSrc)) {
          icon.hidden = true;
          return;
        }
        icon.src = APP_CONFIG.data.defaultAuthorIconSrc;
      });
      author.append(icon);
    }

    const authorText = document.createElement("div");
    const title = document.createElement("h2");
    title.id = "detail-title";
    title.textContent = model.authorName;
    const handle = document.createElement("p");
    handle.className = "detail-handle";
    handle.textContent = model.authorHandle;
    authorText.append(title, handle);
    author.append(authorText);
    fragment.append(author);

    if (model.text !== undefined) {
      const body = document.createElement("p");
      body.className = "detail-body";
      body.textContent = model.text;
      fragment.append(body);
    }

    if (model.media !== undefined) {
      fragment.append(this.createDetailMedia(model));
    }

    const metadata = this.createMetadata(model);
    if (metadata.childElementCount > 0) {
      fragment.append(metadata);
    }

    if (model.postUrl !== undefined) {
      const link = document.createElement("a");
      link.className = "detail-link";
      link.href = model.postUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "元投稿を開く";
      fragment.append(link);
    }

    return fragment;
  }

  private createDetailMedia(model: PostDetailModel): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "detail-media";
    const media = model.media;
    if (media === undefined) {
      return wrapper;
    }

    const errorMessage = document.createElement("p");
    errorMessage.className = "detail-media-status";
    errorMessage.setAttribute("role", "status");

    if (media.type === "image") {
      const image = document.createElement("img");
      image.src = media.src;
      image.alt = media.alt;
      image.addEventListener("error", () => {
        const placeholderSource = getMediaPlaceholderSource("image");
        if (image.src.endsWith(placeholderSource)) {
          image.hidden = true;
          return;
        }
        image.src = placeholderSource;
        image.alt = `${media.alt}（プレースホルダー）`;
        errorMessage.textContent = getMediaLoadErrorMessage("image");
      });
      wrapper.append(image, errorMessage);
      return wrapper;
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("aria-label", media.alt);
    video.poster = media.thumbnailSrc ?? getMediaPlaceholderSource("video");
    video.style.backgroundImage = `url("${getMediaPlaceholderSource("video")}")`;
    video.style.backgroundPosition = "center";
    video.style.backgroundSize = "cover";
    video.addEventListener("error", () => {
      if (this.detailVideo !== video) {
        return;
      }
      this.videoController.stop(video);
      this.updateVideoControls(false, getMediaLoadErrorMessage("video"));
      this.options.onPlayingVideoChange?.(null);
    });
    video.addEventListener("ended", () => {
      if (this.detailVideo !== video) {
        return;
      }
      this.videoController.stop(video);
      this.updateVideoControls(false, "動画の再生が終了しました。");
      this.options.onPlayingVideoChange?.(null);
    });

    const playButton = document.createElement("button");
    playButton.className = "detail-video-button";
    playButton.type = "button";
    playButton.textContent = "動画を再生";
    playButton.addEventListener("click", () => {
      void this.toggleVideoPlayback(
        video,
        playButton,
        errorMessage,
        media.src,
        model.id,
      );
    });

    this.detailVideo = video;
    this.detailVideoButton = playButton;
    this.detailVideoStatus = errorMessage;
    wrapper.append(video, playButton, errorMessage);
    return wrapper;
  }

  private createMetadata(model: PostDetailModel): HTMLDListElement {
    const list = document.createElement("dl");
    list.className = "detail-metadata";
    appendMetadata(list, "投稿日", model.postedAt);
    appendMetadata(list, "いいねした日時", model.likedAt);
    appendMetadata(list, "閲覧数", model.viewCount);
    appendMetadata(list, "いいね数", model.likeCount);
    return list;
  }

  private async toggleVideoPlayback(
    video: HTMLVideoElement,
    button: HTMLButtonElement,
    status: HTMLElement,
    source: string,
    postId: string,
  ): Promise<void> {
    if (this.videoController.isActive(video)) {
      this.videoController.stop(video);
      this.updateVideoControls(false, "動画を停止しました。");
      this.options.onPlayingVideoChange?.(null);
      return;
    }

    if (video.getAttribute("src") === null) {
      video.src = source;
      video.load();
    }

    button.disabled = true;
    status.textContent = "動画を読み込んでいます。";
    try {
      await this.videoController.play(video);
      if (this.detailVideo !== video || !this.videoController.isActive(video)) {
        return;
      }
      this.updateVideoControls(true, "動画を再生中です。音声はミュートされています。");
      this.options.onPlayingVideoChange?.(postId);
    } catch (error: unknown) {
      console.warn("[Fav Collection] 動画を再生できませんでした。", error);
      if (this.detailVideo === video) {
        this.updateVideoControls(false, getVideoPlaybackErrorMessage());
        this.options.onPlayingVideoChange?.(null);
      }
    } finally {
      button.disabled = false;
    }
  }

  private updateVideoControls(playing: boolean, message: string): void {
    if (this.detailVideoButton !== null) {
      this.detailVideoButton.textContent = playing ? "動画を停止" : "動画を再生";
    }
    if (this.detailVideoStatus !== null) {
      this.detailVideoStatus.textContent = message;
    }
  }

  private clearDetail(): void {
    this.videoController.stopAll();
    this.options.onPlayingVideoChange?.(null);
    if (this.detailVideo !== null) {
      this.detailVideo.removeAttribute("src");
      this.detailVideo.load();
    }
    this.detailVideo = null;
    this.detailVideoButton = null;
    this.detailVideoStatus = null;
    this.detailContent.replaceChildren();
  }

  private bindButton(action: string, handler: () => void): void {
    requireElement<HTMLButtonElement>(
      this.container,
      `[data-action="${action}"]`,
    ).addEventListener("click", handler);
  }

  private bindOptionalButton(
    action: string,
    handler: (() => void) | undefined,
  ): void {
    const button = this.container.querySelector<HTMLButtonElement>(
      `[data-action="${action}"]`,
    );
    if (button !== null && handler !== undefined) {
      button.addEventListener("click", handler);
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Tab") {
      const activeModal = this.getActiveModal();
      if (activeModal !== null) {
        trapFocus(event, activeModal);
      }
      return;
    }
    if (event.key !== "Escape" || this.currentState === null) {
      return;
    }
    event.preventDefault();
    if (this.currentState.infoOpen) {
      this.options.onCloseInfo();
    } else if (this.currentState.settingsOpen) {
      this.options.onCloseSettings();
    } else if (this.currentState.selectedPostId !== null) {
      this.options.onCloseDetail();
    }
  };

  private getActiveModal(): HTMLElement | null {
    if (!this.detailLayer.hidden) {
      return this.detailLayer;
    }
    if (!this.infoOverlay.hidden) {
      return this.infoOverlay;
    }
    if (!this.settingsPanel.hidden) {
      return this.settingsPanel;
    }
    return null;
  }
}

function appendMetadata(
  list: HTMLDListElement,
  label: string,
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  list.append(term, description);
}

function requireElement<T extends Element>(
  container: ParentNode,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Preview element was not created: ${selector}`);
  }
  return element;
}

function stopPropagation(event: Event): void {
  event.stopPropagation();
}

function preventXrSelect(event: Event): void {
  event.preventDefault();
}

function getFocusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}

function restoreFocus(element: HTMLElement | null): void {
  if (element?.isConnected) {
    element.focus();
  }
}

function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
