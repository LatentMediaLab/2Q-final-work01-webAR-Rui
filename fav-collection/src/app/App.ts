import type { AppMode, AppState } from "./AppState";
import { APP_CONFIG } from "./config";
import {
  getRecoveryOptions,
  type AppErrorKind,
  type RecoveryAction,
} from "./ErrorRecovery";
import {
  createInitialPreviewUiState,
  reducePreviewUiState,
  type PreviewUiAction,
} from "./PreviewState";
import { readPostsDataUrl } from "./readPostsDataUrl";
import { readRequestedMode } from "./readRequestedMode";
import { readDebugEnabled } from "./readDebugEnabled";
import type { ArPlacementState } from "../ar/ArState";
import {
  canUseCameraFallback,
  getCameraErrorMessage,
  getCameraErrorKind,
} from "../ar/CameraAccess";
import { FallbackARController } from "../ar/FallbackARController";
import type {
  FallbackPlacementState,
  FallbackTrackingMode,
} from "../ar/FallbackState";
import { WebXRSceneManager } from "../ar/WebXRSceneManager";
import { requestArSession } from "../ar/WebXRSession";
import { checkImmersiveArSupport } from "../ar/WebXRSupport";
import { JsonPostRepository } from "../data/JsonPostRepository";
import type { PostRepository } from "../data/PostRepository";
import type { PostRecord } from "../data/PostTypes";
import type { ValidationIssue } from "../data/validatePosts";
import { DebugOverlay } from "../debug/DebugOverlay";
import { SceneManager } from "../scene/SceneManager";
import { disposeSharedFrameMaterials } from "../scene/FrameFactory";
import { disposeSharedCanvasTextures } from "../scene/CanvasTextureFactory";
import { sharedPostTextureRepository } from "../scene/SharedPostTextureRepository";
import { isWebGLAvailable } from "../scene/WebGLSupport";
import { renderErrorView } from "../ui/ErrorView";
import { renderIntroView } from "../ui/IntroView";
import { renderLoadingView } from "../ui/LoadingView";
import {
  renderPreviewView,
  type PreviewViewController,
} from "../ui/PreviewView";

function reportValidationIssues(issues: readonly ValidationIssue[]): void {
  issues.forEach((issue) => {
    const location = issue.index === null ? "ルート" : `投稿[${issue.index}]`;
    console.warn(
      `[Fav Collection] ${location}: ${issue.message}`,
      issue.id === undefined ? "" : `(id: ${issue.id})`,
    );
  });
}

function createDefaultRepository(url: string): PostRepository {
  const shouldUseFallback =
    url === APP_CONFIG.data.postsApiUrl || url === APP_CONFIG.data.customPostsUrl;

  return new JsonPostRepository({
    url,
    ...(shouldUseFallback
      ? { fallbackUrl: APP_CONFIG.data.placeholderPostsUrl }
      : {}),
    onValidationIssues: reportValidationIssues,
    onFallback: (error, fallbackUrl) => {
      console.warn(
        `[Fav Collection] 選択中の投稿データへアクセスできないため、プレースホルダーへ切り替えます。 (${fallbackUrl})`,
        error,
      );
    },
  });
}

export class App {
  private state: AppState;
  private sceneManager: SceneManager | null = null;
  private previewView: PreviewViewController | null = null;
  private xrSceneManager: WebXRSceneManager | null = null;
  private arView: PreviewViewController | null = null;
  private fallbackController: FallbackARController | null = null;
  private fallbackView: PreviewViewController | null = null;
  private posts: readonly PostRecord[] = [];
  private loadRequestId = 0;
  private supportRequestId = 0;
  private readonly postRepository: PostRepository;
  private readonly reducedMotionPreferred: boolean;
  private readonly reducedMotionQuery: MediaQueryList;
  private readonly debugOverlay: DebugOverlay | null;

  public constructor(
    private readonly root: HTMLElement,
    locationSearch: string,
    postRepository?: PostRepository,
  ) {
    this.postRepository =
      postRepository ?? createDefaultRepository(readPostsDataUrl(locationSearch));
    this.reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    this.reducedMotionPreferred = this.reducedMotionQuery.matches;
    this.state = {
      mode: "boot",
      requestedMode: readRequestedMode(locationSearch),
      notice: null,
      error: null,
      postCount: 0,
      previewUi: createInitialPreviewUiState(this.reducedMotionPreferred),
      arSupportStatus: "checking",
      arPlacementState: "loading",
      fallbackPlacementState: "aiming",
      fallbackTrackingMode: null,
      detailReturnMode: null,
      playingVideoId: null,
    };
    this.reducedMotionQuery.addEventListener(
      "change",
      this.handleReducedMotionChange,
    );
    this.debugOverlay = readDebugEnabled(locationSearch)
      ? new DebugOverlay(document.body, this.createDebugSnapshot())
      : null;
  }

  public start(): void {
    if (this.state.requestedMode === "preview") {
      void this.refreshArSupport();
      void this.loadPreview();
      return;
    }

    this.transitionTo("intro");
    void this.refreshArSupport();
  }

  public dispose(): void {
    this.loadRequestId += 1;
    this.supportRequestId += 1;
    this.disposeScene();
    this.disposeXrScene();
    this.disposeFallbackScene();
    this.reducedMotionQuery.removeEventListener(
      "change",
      this.handleReducedMotionChange,
    );
    this.debugOverlay?.dispose();
    sharedPostTextureRepository.dispose();
    disposeSharedCanvasTextures();
    disposeSharedFrameMaterials();
  }

  private async loadPreview(): Promise<void> {
    if (!this.ensureWebGLAvailable()) {
      return;
    }
    const requestId = this.loadRequestId + 1;
    this.loadRequestId = requestId;
    this.transitionTo("loading", { error: null, notice: null });

    try {
      const posts = await this.postRepository.getPosts();
      if (requestId !== this.loadRequestId) {
        return;
      }

      if (posts.length === 0) {
        this.showError(
          "empty-data",
          "コレクションは空です",
          "表示できる投稿がありません。選択中の投稿データへ有効な投稿を追加してから再読み込みしてください。",
        );
        return;
      }

      this.posts = posts;
      this.transitionTo("preview", {
        error: null,
        postCount: posts.length,
        detailReturnMode: null,
      });
    } catch (error: unknown) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      console.error("[Fav Collection] 投稿データを読み込めませんでした。", error);
      this.showError(
        "data",
        "投稿データを読み込めませんでした",
        "JSONの取得または解析に失敗しました。接続と選択中の投稿データを確認して、再読み込みしてください。",
      );
    }
  }

  private transitionTo(
    mode: AppMode,
    changes: Partial<Omit<AppState, "mode">> = {},
  ): void {
    if (mode !== "preview" && mode !== "detail") {
      this.disposeScene();
    }

    this.state = { ...this.state, ...changes, mode };
    this.render();
  }

  private showError(
    kind: AppErrorKind,
    title: string,
    message: string,
  ): void {
    this.posts = [];
    this.disposeXrScene();
    this.disposeFallbackScene();
    this.transitionTo("error", {
      error: { kind, title, message },
      postCount: 0,
      previewUi: createInitialPreviewUiState(this.reducedMotionPreferred),
      arPlacementState: "loading",
      fallbackPlacementState: "aiming",
      fallbackTrackingMode: null,
      detailReturnMode: null,
      playingVideoId: null,
    });
  }

  private showIntro(): void {
    this.loadRequestId += 1;
    this.posts = [];
    this.disposeXrScene();
    this.disposeFallbackScene();
    this.transitionTo("intro", {
      error: null,
      notice: null,
      postCount: 0,
      previewUi: createInitialPreviewUiState(this.reducedMotionPreferred),
      arPlacementState: "loading",
      fallbackPlacementState: "aiming",
      fallbackTrackingMode: null,
      detailReturnMode: null,
      playingVideoId: null,
    });
    void this.refreshArSupport();
  }

  private disposeScene(): void {
    this.sceneManager?.dispose();
    this.sceneManager = null;
    this.previewView?.dispose();
    this.previewView = null;
  }

  private disposeXrScene(): void {
    this.xrSceneManager?.dispose();
    this.xrSceneManager = null;
    this.arView?.dispose();
    this.arView = null;
  }

  private disposeFallbackScene(): void {
    this.fallbackController?.dispose();
    this.fallbackController = null;
    this.fallbackView?.dispose();
    this.fallbackView = null;
  }

  private render(): void {
    this.updateDebugOverlay();
    switch (this.state.mode) {
      case "boot":
        this.root.replaceChildren();
        break;
      case "intro":
        renderIntroView(this.root, {
          requestedMode: this.state.requestedMode,
          notice: this.state.notice,
          arSupportStatus: this.state.arSupportStatus,
          onStartAr: () => void this.startAr(),
          onStartPreview: () => void this.loadPreview(),
        });
        break;
      case "loading":
        renderLoadingView(this.root);
        break;
      case "preview":
        this.renderPreview();
        break;
      case "scanning":
      case "placed":
        this.renderAr();
        break;
      case "fallback":
        this.renderFallback();
        break;
      case "detail":
        this.renderDetail();
        break;
      case "error":
        this.renderError();
        break;
      default:
        this.showError(
          "exhibition",
          "このモードは未実装です",
          "最初の画面に戻り、通常プレビューを選択してください。",
        );
    }
  }

  private renderPreview(): void {
    if (this.sceneManager !== null && this.previewView !== null) {
      this.previewView.hideDetail();
      this.previewView.updateUi(this.state.previewUi);
      return;
    }

    const previewView = renderPreviewView(this.root, {
      postCount: this.state.postCount,
      onBack: () => this.showIntro(),
      onCloseDetail: () => this.closeDetail(),
      onOpenSettings: () => this.updatePreviewUi({ type: "open-settings" }),
      onCloseSettings: () => this.updatePreviewUi({ type: "close-settings" }),
      onOpenInfo: () => this.updatePreviewUi({ type: "open-info" }),
      onCloseInfo: () => this.updatePreviewUi({ type: "close-info" }),
      onToggleTextAnimation: () => this.toggleTextAnimation(),
      onStopVideos: () => this.previewView?.stopAllVideos(),
      onPlayingVideoChange: (postId) => this.handlePlayingVideoChange(postId),
      onToggleCaptions: () => this.toggleCaptions(),
      onResetCamera: () => this.sceneManager?.resetCamera(),
    });
    this.previewView = previewView;
    previewView.updateUi(this.state.previewUi);

    try {
      const sceneManager = new SceneManager(previewView.viewport, {
        onPostSelected: (postId) => this.openDetail(postId),
      });
      this.sceneManager = sceneManager;
      sceneManager.setTextAnimationPaused(
        this.state.previewUi.textAnimationPaused,
      );
      sceneManager.setCaptionsVisible(this.state.previewUi.captionsVisible);
      void sceneManager.load(this.posts).catch((error: unknown) => {
        if (this.sceneManager !== sceneManager) {
          return;
        }
        console.error("[Fav Collection] 展示物を生成できませんでした。", error);
        this.showError(
          "exhibition",
          "展示物を生成できませんでした",
          "投稿データまたは表示素材を確認し、再読み込みしてください。",
        );
      });
    } catch (error: unknown) {
      console.error("[Fav Collection] 3Dプレビューを開始できませんでした。", error);
      this.showError(
        "webgl",
        "3Dプレビューを開始できませんでした",
        "WebGLが利用できるブラウザか確認し、再読み込みしてください。",
      );
    }
  }

  private async refreshArSupport(): Promise<void> {
    const requestId = this.supportRequestId + 1;
    this.supportRequestId = requestId;
    this.state = { ...this.state, arSupportStatus: "checking" };
    if (this.state.mode === "intro") {
      this.render();
    }

    const status = await checkImmersiveArSupport(navigator.xr);
    if (requestId !== this.supportRequestId) {
      return;
    }
    this.state = { ...this.state, arSupportStatus: status };
    if (this.state.mode === "intro") {
      this.render();
    } else {
      this.updateDebugOverlay();
    }
  }

  private async startAr(): Promise<void> {
    const xr = navigator.xr;
    if (xr === undefined || this.state.arSupportStatus !== "supported") {
      await this.startFallback();
      return;
    }
    if (!this.ensureWebGLAvailable()) {
      return;
    }

    const requestId = this.loadRequestId + 1;
    this.loadRequestId = requestId;
    this.disposeScene();
    this.disposeXrScene();
    this.posts = [];
    this.state = {
      ...this.state,
      mode: "scanning",
      notice: null,
      error: null,
      postCount: 0,
      arPlacementState: "loading",
      detailReturnMode: null,
      previewUi: createInitialPreviewUiState(this.reducedMotionPreferred),
      playingVideoId: null,
    };
    this.render();

    const view = this.arView;
    const manager = this.xrSceneManager;
    if (view === null || manager === null) {
      this.showError(
        "webgl",
        "AR表示を準備できませんでした",
        "WebGLが利用できるブラウザか確認してください。",
      );
      return;
    }

    let startStage: "session" | "data" | "exhibition" = "session";
    try {
      const session = await requestArSession(xr, view.overlayRoot);
      if (requestId !== this.loadRequestId) {
        await session.end();
        return;
      }
      await manager.startSession(session);
      startStage = "data";
      const posts = await this.postRepository.getPosts();
      if (requestId !== this.loadRequestId) {
        await manager.endSession();
        return;
      }
      if (posts.length === 0) {
        this.disposeXrScene();
        this.showError(
          "empty-data",
          "コレクションは空です",
          "ARへ表示できる有効な投稿がありません。投稿データを確認してください。",
        );
        return;
      }

      this.posts = posts;
      this.state = { ...this.state, postCount: posts.length };
      view.updatePostCount(posts.length);
      this.updateDebugOverlay();
      startStage = "exhibition";
      await manager.load(posts);
    } catch (error: unknown) {
      console.error("[Fav Collection] ARを開始できませんでした。", error);
      if (this.xrSceneManager === manager) {
        this.disposeXrScene();
        if (startStage === "data") {
          this.showError(
            "data",
            "投稿データを読み込めませんでした",
            "ARセッションは開始しましたが、JSONの取得または解析に失敗しました。投稿データを確認してください。",
          );
        } else if (startStage === "exhibition") {
          this.showError(
            "exhibition",
            "AR展示を生成できませんでした",
            "投稿データまたは表示素材を確認し、通常プレビューで再試行してください。",
          );
        } else {
          this.showError(
            "xr-session",
            "ARセッションを開始できませんでした",
            "WebXRセッションが拒否されたか、Hit Testの初期化に失敗しました。簡易ARまたは通常プレビューを選べます。",
          );
        }
      }
    }
  }

  private async startFallback(): Promise<void> {
    if (!this.ensureWebGLAvailable()) {
      return;
    }
    const mediaDevices = navigator.mediaDevices;
    if (!canUseCameraFallback(mediaDevices)) {
      this.showError(
        "camera-unavailable",
        "カメラを利用できません",
        "簡易ARにはカメラを利用できるHTTPS接続が必要です。HTTPSで開くか、通常プレビューをご利用ください。",
      );
      return;
    }

    const requestId = this.loadRequestId + 1;
    this.loadRequestId = requestId;
    this.disposeScene();
    this.disposeXrScene();
    this.disposeFallbackScene();
    this.posts = [];
    this.state = {
      ...this.state,
      mode: "fallback",
      notice: null,
      error: null,
      postCount: 0,
      fallbackPlacementState: "aiming",
      fallbackTrackingMode: null,
      detailReturnMode: null,
      previewUi: createInitialPreviewUiState(this.reducedMotionPreferred),
      playingVideoId: null,
    };
    this.render();

    const controller = this.fallbackController;
    const view = this.fallbackView;
    if (controller === null || view === null) {
      this.showError(
        "webgl",
        "簡易ARを準備できませんでした",
        "WebGLが利用できるブラウザか確認してください。",
      );
      return;
    }

    const cameraResult = controller
      .startCamera(mediaDevices)
      .then(() => ({ ok: true as const }))
      .catch((error: unknown) => ({ ok: false as const, error }));
    const postsResult = this.postRepository
      .getPosts()
      .then((posts) => ({ ok: true as const, posts }))
      .catch((error: unknown) => ({ ok: false as const, error }));
    const [camera, posts] = await Promise.all([cameraResult, postsResult]);
    if (requestId !== this.loadRequestId) {
      return;
    }
    if (!camera.ok) {
      console.error("[Fav Collection] カメラを開始できませんでした。", camera.error);
      this.showError(
        getCameraErrorKind(camera.error) === "permission"
          ? "camera-permission"
          : "camera-unavailable",
        "カメラを開始できませんでした",
        getCameraErrorMessage(camera.error),
      );
      return;
    }
    if (!posts.ok) {
      console.error("[Fav Collection] 投稿データを読み込めませんでした。", posts.error);
      this.showError(
        "data",
        "投稿データを読み込めませんでした",
        "JSONの取得または解析に失敗しました。接続と投稿データを確認してください。",
      );
      return;
    }
    if (posts.posts.length === 0) {
      this.showError(
        "empty-data",
        "コレクションは空です",
        "簡易ARへ表示できる投稿がありません。",
      );
      return;
    }

    this.posts = posts.posts;
    this.state = { ...this.state, postCount: posts.posts.length };
    view.updatePostCount(posts.posts.length);
    this.updateDebugOverlay();
    try {
      await controller.load(posts.posts);
    } catch (error: unknown) {
      console.error("[Fav Collection] 簡易AR展示を生成できませんでした。", error);
      this.showError(
        "exhibition",
        "簡易AR展示を生成できませんでした",
        "投稿データまたは表示素材を確認してください。",
      );
    }
  }

  private renderAr(): void {
    if (this.arView !== null && this.xrSceneManager !== null) {
      this.arView.hideDetail();
      this.arView.updateUi(this.state.previewUi);
      this.arView.updateArState(this.state.arPlacementState);
      return;
    }

    const arView = renderPreviewView(this.root, {
      experience: "ar",
      postCount: this.state.postCount,
      onBack: () => undefined,
      onCloseDetail: () => this.closeDetail(),
      onOpenSettings: () => this.updatePreviewUi({ type: "open-settings" }),
      onCloseSettings: () => this.updatePreviewUi({ type: "close-settings" }),
      onOpenInfo: () => this.updatePreviewUi({ type: "open-info" }),
      onCloseInfo: () => this.updatePreviewUi({ type: "close-info" }),
      onToggleTextAnimation: () => this.toggleTextAnimation(),
      onStopVideos: () => this.arView?.stopAllVideos(),
      onPlayingVideoChange: (postId) => this.handlePlayingVideoChange(postId),
      onToggleCaptions: () => this.toggleCaptions(),
      onResetCamera: () => undefined,
      onExitAr: () => {
        this.arView?.stopAllVideos();
        void this.xrSceneManager?.endSession();
      },
      onReposition: () => {
        this.arView?.stopAllVideos();
        this.updatePreviewUi({ type: "close-settings" });
        this.xrSceneManager?.startRepositioning();
      },
    });
    this.arView = arView;
    arView.updateUi(this.state.previewUi);
    arView.updateArState(this.state.arPlacementState);

    try {
      const manager = new WebXRSceneManager(arView.viewport, {
        onPlacementStateChange: (state) => this.handleArPlacementState(state),
        onPostSelected: (postId) => this.openDetail(postId),
        onSessionEnded: (expected) => this.handleArSessionEnded(expected),
      });
      manager.setTextAnimationPaused(this.state.previewUi.textAnimationPaused);
      manager.setCaptionsVisible(this.state.previewUi.captionsVisible);
      this.xrSceneManager = manager;
    } catch (error: unknown) {
      console.error("[Fav Collection] ARレンダラーを作成できませんでした。", error);
      this.showError(
        "webgl",
        "AR表示を準備できませんでした",
        "WebGLが利用できるブラウザか確認してください。",
      );
    }
  }

  private handleArPlacementState(state: ArPlacementState): void {
    this.state = {
      ...this.state,
      mode: state === "placed" ? "placed" : "scanning",
      arPlacementState: state,
    };
    this.arView?.updateArState(state);
    this.updateDebugOverlay();
  }

  private handleArSessionEnded(expected: boolean): void {
    this.loadRequestId += 1;
    this.posts = [];
    this.disposeXrScene();
    if (!expected) {
      this.showError(
        "xr-ended",
        "ARセッションが終了しました",
        "ブラウザまたは端末によってARセッションが予期せず終了されました。簡易ARまたは通常プレビューへ移行できます。",
      );
      return;
    }
    this.state = {
      ...this.state,
      mode: "intro",
      notice: null,
      error: null,
      postCount: 0,
      arPlacementState: "loading",
      detailReturnMode: null,
      previewUi: createInitialPreviewUiState(this.reducedMotionPreferred),
      playingVideoId: null,
    };
    this.render();
    void this.refreshArSupport();
  }

  private renderFallback(): void {
    if (this.fallbackView !== null && this.fallbackController !== null) {
      this.fallbackView.hideDetail();
      this.fallbackView.updateUi(this.state.previewUi);
      this.fallbackView.updateFallbackState(
        this.state.fallbackPlacementState,
        this.state.fallbackTrackingMode,
      );
      return;
    }

    const fallbackView = renderPreviewView(this.root, {
      experience: "fallback",
      postCount: this.state.postCount,
      onBack: () => undefined,
      onCloseDetail: () => this.closeDetail(),
      onOpenSettings: () => this.updatePreviewUi({ type: "open-settings" }),
      onCloseSettings: () => this.updatePreviewUi({ type: "close-settings" }),
      onOpenInfo: () => this.updatePreviewUi({ type: "open-info" }),
      onCloseInfo: () => this.updatePreviewUi({ type: "close-info" }),
      onToggleTextAnimation: () => this.toggleTextAnimation(),
      onStopVideos: () => this.fallbackView?.stopAllVideos(),
      onPlayingVideoChange: (postId) => this.handlePlayingVideoChange(postId),
      onToggleCaptions: () => this.toggleCaptions(),
      onResetCamera: () => undefined,
      onExitFallback: () => {
        this.fallbackView?.stopAllVideos();
        this.showIntro();
      },
      onPlaceFallbackWall: () => void this.fallbackController?.placeOnWall(),
      onResetFallback: () => this.fallbackController?.resetAdjustment(),
      onResetFallbackWall: () => this.fallbackController?.resetWall(),
      onToggleFallbackAdjustment: () =>
        this.fallbackController?.toggleAdjustment(),
    });
    this.fallbackView = fallbackView;
    fallbackView.updateUi(this.state.previewUi);
    fallbackView.updateFallbackState(
      this.state.fallbackPlacementState,
      this.state.fallbackTrackingMode,
    );

    try {
      const controller = new FallbackARController(fallbackView.viewport, {
        onPostSelected: (postId) => this.openDetail(postId),
        onPlacementStateChange: (state, trackingMode) =>
          this.handleFallbackPlacementState(state, trackingMode),
      });
      controller.setTextAnimationPaused(
        this.state.previewUi.textAnimationPaused,
      );
      controller.setCaptionsVisible(this.state.previewUi.captionsVisible);
      this.fallbackController = controller;
    } catch (error: unknown) {
      console.error("[Fav Collection] 簡易ARレンダラーを作成できませんでした。", error);
      this.showError(
        "webgl",
        "簡易ARを準備できませんでした",
        "WebGLが利用できるブラウザか確認してください。",
      );
    }
  }

  private handleFallbackPlacementState(
    state: FallbackPlacementState,
    trackingMode: FallbackTrackingMode | null,
  ): void {
    this.state = {
      ...this.state,
      fallbackPlacementState: state,
      fallbackTrackingMode: trackingMode,
    };
    this.fallbackView?.updateFallbackState(state, trackingMode);
    this.updateDebugOverlay();
  }

  private renderDetail(): void {
    const selectedPostId = this.state.previewUi.selectedPostId;
    const selectedPost = this.posts.find((post) => post.id === selectedPostId);
    const view = this.getDetailView();
    const sceneAvailable = this.isDetailSceneAvailable();
    if (
      selectedPostId === null ||
      selectedPost === undefined ||
      view === null ||
      !sceneAvailable
    ) {
      this.closeDetail();
      return;
    }

    view.updateUi(this.state.previewUi);
    view.showDetail(selectedPost);
  }

  private openDetail(postId: string): void {
    if (!this.posts.some((post) => post.id === postId)) {
      return;
    }
    this.fallbackController?.setInteractionEnabled(false);

    this.state = {
      ...this.state,
      mode: "detail",
      detailReturnMode:
        this.xrSceneManager !== null
          ? "placed"
          : this.fallbackController !== null
            ? "fallback"
            : "preview",
      previewUi: reducePreviewUiState(this.state.previewUi, {
        type: "open-detail",
        postId,
      }),
    };
    this.render();
  }

  private closeDetail(): void {
    if (this.state.mode !== "detail") {
      return;
    }

    this.state = {
      ...this.state,
      mode: this.state.detailReturnMode ?? "preview",
      detailReturnMode: null,
      previewUi: reducePreviewUiState(this.state.previewUi, {
        type: "close-detail",
      }),
    };
    this.render();
    this.fallbackController?.setInteractionEnabled(true);
  }

  private toggleTextAnimation(): void {
    this.updatePreviewUi({ type: "toggle-text-animation" });
    this.sceneManager?.setTextAnimationPaused(
      this.state.previewUi.textAnimationPaused,
    );
    this.xrSceneManager?.setTextAnimationPaused(
      this.state.previewUi.textAnimationPaused,
    );
    this.fallbackController?.setTextAnimationPaused(
      this.state.previewUi.textAnimationPaused,
    );
  }

  private toggleCaptions(): void {
    this.updatePreviewUi({ type: "toggle-captions" });
    this.sceneManager?.setCaptionsVisible(this.state.previewUi.captionsVisible);
    this.xrSceneManager?.setCaptionsVisible(this.state.previewUi.captionsVisible);
    this.fallbackController?.setCaptionsVisible(
      this.state.previewUi.captionsVisible,
    );
  }

  private updatePreviewUi(action: PreviewUiAction): void {
    this.state = {
      ...this.state,
      previewUi: reducePreviewUiState(this.state.previewUi, action),
    };
    this.previewView?.updateUi(this.state.previewUi);
    this.arView?.updateUi(this.state.previewUi);
    this.fallbackView?.updateUi(this.state.previewUi);
    this.updateDebugOverlay();
  }

  private getDetailView(): PreviewViewController | null {
    switch (this.state.detailReturnMode) {
      case "placed":
        return this.arView;
      case "fallback":
        return this.fallbackView;
      case "preview":
      case null:
        return this.previewView;
    }
  }

  private isDetailSceneAvailable(): boolean {
    switch (this.state.detailReturnMode) {
      case "placed":
        return this.xrSceneManager !== null;
      case "fallback":
        return this.fallbackController !== null;
      case "preview":
      case null:
        return this.sceneManager !== null;
    }
  }

  private renderError(): void {
    const error = this.state.error ?? {
      kind: "exhibition" as const,
      title: "エラーが発生しました",
      message: "最初の画面に戻り、もう一度お試しください。",
    };

    renderErrorView(this.root, {
      title: error.title,
      message: error.message,
      recoveryOptions: getRecoveryOptions(
        error.kind,
        canUseCameraFallback(navigator.mediaDevices),
      ),
      onRecover: (option) => this.performRecovery(option.action),
    });
  }

  private performRecovery(action: RecoveryAction): void {
    switch (action) {
      case "retry":
        if (
          this.state.error?.kind === "camera-permission" ||
          this.state.error?.kind === "camera-unavailable"
        ) {
          void this.startFallback();
        } else {
          void this.loadPreview();
        }
        break;
      case "fallback":
        void this.startFallback();
        break;
      case "preview":
        void this.loadPreview();
        break;
      case "intro":
        this.showIntro();
        break;
    }
  }

  private ensureWebGLAvailable(): boolean {
    if (isWebGLAvailable()) {
      return true;
    }
    this.showError(
      "webgl",
      "3D表示を利用できません",
      "このブラウザではWebGLを開始できませんでした。WebGLを有効にして表示を再試行してください。",
    );
    return false;
  }

  private handlePlayingVideoChange(postId: string | null): void {
    if (this.state.playingVideoId === postId) {
      return;
    }
    this.state = { ...this.state, playingVideoId: postId };
    this.updateDebugOverlay();
  }

  private readonly handleReducedMotionChange = (
    event: MediaQueryListEvent,
  ): void => {
    if (!event.matches || this.state.previewUi.textAnimationPaused) {
      return;
    }
    this.updatePreviewUi({
      type: "set-text-animation-paused",
      paused: true,
    });
    this.sceneManager?.setTextAnimationPaused(true);
    this.xrSceneManager?.setTextAnimationPaused(true);
    this.fallbackController?.setTextAnimationPaused(true);
  };

  private createDebugSnapshot() {
    return {
      postCount: this.state.postCount,
      appMode: this.state.mode,
      xrSupport: this.state.arSupportStatus,
      arPlacement: this.state.arPlacementState,
      fallbackPlacement: this.state.fallbackPlacementState,
      selectedPostId: this.state.previewUi.selectedPostId,
      playingVideoId: this.state.playingVideoId,
      detailReturnMode: this.state.detailReturnMode,
    };
  }

  private updateDebugOverlay(): void {
    this.debugOverlay?.update(this.createDebugSnapshot());
  }
}
