import * as THREE from "three";
import { APP_CONFIG } from "../app/config";
import type { PostRecord } from "../data/PostTypes";
import { PostRaycaster } from "../interaction/PostRaycaster";
import { Exhibition } from "../scene/Exhibition";
import {
  getRendererPixelRatio,
  shouldUseAntialias,
} from "../scene/rendererPerformance";
import { requestRearCamera, stopMediaStream } from "./CameraAccess";
import {
  createDeviceOrientationQuaternion,
  createRelativeDeviceOrientation,
  requestDeviceOrientationAccess,
  type DeviceOrientationAccess,
  type DeviceOrientationPermissionRequester,
} from "./FallbackOrientation";
import type {
  FallbackPlacementState,
  FallbackTrackingMode,
} from "./FallbackState";
import {
  createGestureMetrics,
  DEFAULT_FALLBACK_TRANSFORM,
  transformFromGesture,
  type FallbackTransform,
  type GestureMetrics,
  type GesturePoint,
} from "./FallbackTransform";

interface FallbackARControllerOptions {
  readonly onPostSelected: (postId: string) => void;
  readonly onPlacementStateChange: (
    state: FallbackPlacementState,
    trackingMode: FallbackTrackingMode | null,
  ) => void;
}

interface GestureSnapshot {
  readonly metrics: GestureMetrics;
  readonly transform: FallbackTransform;
}

interface SelectionStart extends GesturePoint {
  readonly pointerId: number;
}

export class FallbackARController {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly video: HTMLVideoElement;
  private readonly exhibition = new Exhibition();
  private readonly exhibitionRoot = new THREE.Group();
  private readonly postRaycaster = new PostRaycaster();
  private readonly pointers = new Map<number, GesturePoint>();
  private stream: MediaStream | null = null;
  private transform: FallbackTransform = DEFAULT_FALLBACK_TRANSFORM;
  private gestureSnapshot: GestureSnapshot | null = null;
  private selectionStart: SelectionStart | null = null;
  private orientationAccess: DeviceOrientationAccess | null = null;
  private orientationReference: THREE.Quaternion | null = null;
  private orientationListening = false;
  private wallPlaced = false;
  private locked = false;
  private interactionEnabled = true;
  private disposed = false;

  public constructor(
    private readonly container: HTMLElement,
    private readonly options: FallbackARControllerOptions,
  ) {
    this.video = document.createElement("video");
    this.video.className = "fallback-camera-video";
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.disablePictureInPicture = true;
    this.video.setAttribute("aria-hidden", "true");
    this.container.append(this.video);

    const { width, height } = this.getViewportSize();
    this.camera = new THREE.PerspectiveCamera(
      APP_CONFIG.preview.cameraFov,
      width / height,
      APP_CONFIG.preview.cameraNear,
      APP_CONFIG.preview.cameraFar,
    );
    this.camera.position.set(0, 0, APP_CONFIG.fallback.cameraDistance);

    this.renderer = new THREE.WebGLRenderer({
      antialias: shouldUseAntialias(window.devicePixelRatio),
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(getRendererPixelRatio(window.devicePixelRatio));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "preview-canvas fallback-canvas";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "背面カメラ上の簡易AR展示。壁面を手動設定すると端末の向きに応じて展示の見える範囲が変化します。Enterキーで投稿を選択できます。",
    );
    this.container.append(this.renderer.domElement);

    const hemisphereLight = new THREE.HemisphereLight(0xfff6df, 0x302b24, 1.8);
    const directionalLight = new THREE.DirectionalLight(0xffecd0, 1.25);
    directionalLight.position.set(1.8, 2.4, 3.5);
    this.scene.add(hemisphereLight, directionalLight);

    this.exhibitionRoot.add(this.exhibition.group);
    this.exhibitionRoot.visible = false;
    this.scene.add(this.exhibitionRoot);
    this.applyTransform();

    window.addEventListener("resize", this.handleResize);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.handlePointerUp);
    this.renderer.domElement.addEventListener("keydown", this.handleKeyDown);
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  public async startCamera(mediaDevices: MediaDevices): Promise<void> {
    const stream = await requestRearCamera(mediaDevices);
    if (this.disposed) {
      stopMediaStream(stream);
      return;
    }
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
  }

  public async load(posts: readonly PostRecord[]): Promise<void> {
    if (this.disposed) {
      return;
    }
    await this.exhibition.load(posts);
  }

  public setCaptionsVisible(visible: boolean): void {
    this.exhibition.setCaptionsVisible(visible);
  }

  public setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
    if (!enabled) {
      this.pointers.clear();
      this.gestureSnapshot = null;
      this.selectionStart = null;
    }
  }

  public async placeOnWall(): Promise<void> {
    if (this.disposed || this.wallPlaced) {
      return;
    }

    this.options.onPlacementStateChange("placing", null);
    const requester = getDeviceOrientationRequester();
    this.orientationAccess ??= await requestDeviceOrientationAccess(requester);
    if (this.disposed) {
      return;
    }

    if (this.orientationAccess === "granted" && !this.orientationListening) {
      window.addEventListener("deviceorientation", this.handleDeviceOrientation);
      this.orientationListening = true;
    }

    this.wallPlaced = true;
    this.locked = true;
    this.orientationReference = null;
    this.camera.quaternion.identity();
    this.transform = DEFAULT_FALLBACK_TRANSFORM;
    this.applyTransform();
    this.exhibitionRoot.visible = true;
    this.options.onPlacementStateChange("placed", this.getTrackingMode());
  }

  public toggleAdjustment(): void {
    if (!this.wallPlaced) {
      return;
    }
    this.locked = !this.locked;
    this.pointers.clear();
    this.gestureSnapshot = null;
    this.selectionStart = null;
    this.options.onPlacementStateChange(
      this.locked ? "placed" : "adjusting",
      this.getTrackingMode(),
    );
  }

  public resetAdjustment(): void {
    this.transform = DEFAULT_FALLBACK_TRANSFORM;
    this.pointers.clear();
    this.gestureSnapshot = null;
    this.selectionStart = null;
    this.applyTransform();
  }

  public resetWall(): void {
    this.wallPlaced = false;
    this.locked = false;
    this.orientationReference = null;
    this.camera.quaternion.identity();
    this.transform = DEFAULT_FALLBACK_TRANSFORM;
    this.pointers.clear();
    this.gestureSnapshot = null;
    this.selectionStart = null;
    this.applyTransform();
    this.exhibitionRoot.visible = false;
    this.options.onPlacementStateChange("aiming", null);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    window.removeEventListener("resize", this.handleResize);
    if (this.orientationListening) {
      window.removeEventListener("deviceorientation", this.handleDeviceOrientation);
      this.orientationListening = false;
    }
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("pointercancel", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("keydown", this.handleKeyDown);
    this.renderer.setAnimationLoop(null);
    stopMediaStream(this.stream);
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.video.remove();
    this.exhibition.dispose();
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private readonly renderFrame = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.interactionEnabled || !this.wallPlaced) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.locked) {
      if (this.pointers.size === 1) {
        this.selectionStart = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
      } else {
        this.selectionStart = null;
      }
      return;
    }
    this.captureGestureSnapshot();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.interactionEnabled || !this.wallPlaced) {
      return;
    }
    if (!this.pointers.has(event.pointerId)) {
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.locked || this.gestureSnapshot === null) {
      return;
    }
    const currentGesture = createGestureMetrics([...this.pointers.values()]);
    if (currentGesture === null) {
      return;
    }
    this.transform = transformFromGesture(
      this.gestureSnapshot.transform,
      this.gestureSnapshot.metrics,
      currentGesture,
      this.container.clientWidth,
      this.container.clientHeight,
    );
    this.applyTransform();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.interactionEnabled || !this.wallPlaced) {
      return;
    }
    const selectionStart = this.selectionStart;
    if (
      this.locked &&
      event.type === "pointerup" &&
      selectionStart !== null &&
      selectionStart.pointerId === event.pointerId &&
      Math.hypot(
        event.clientX - selectionStart.x,
        event.clientY - selectionStart.y,
      ) <= 8
    ) {
      const postId = this.postRaycaster.pickPostId(
        event.clientX,
        event.clientY,
        this.renderer.domElement,
        this.camera,
        this.exhibition.getSelectableObjects(),
      );
      if (postId !== null) {
        this.options.onPostSelected(postId);
      }
    }

    this.pointers.delete(event.pointerId);
    this.selectionStart = null;
    if (!this.locked) {
      this.captureGestureSnapshot();
    }
  };

  private captureGestureSnapshot(): void {
    const metrics = createGestureMetrics([...this.pointers.values()]);
    this.gestureSnapshot =
      metrics === null ? null : { metrics, transform: this.transform };
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.interactionEnabled ||
      !this.wallPlaced ||
      !this.locked ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }
    event.preventDefault();
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const selectableObjects = this.exhibition.getSelectableObjects();
    const postId = this.postRaycaster.pickPostId(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
      this.renderer.domElement,
      this.camera,
      selectableObjects,
    );
    const firstPostId = selectableObjects[0]?.userData.postId;
    const keyboardPostId =
      postId ?? (typeof firstPostId === "string" ? firstPostId : null);
    if (keyboardPostId !== null) {
      this.options.onPostSelected(keyboardPostId);
    }
  };

  private applyTransform(): void {
    this.exhibitionRoot.position.set(this.transform.x, this.transform.y, 0);
    this.exhibitionRoot.scale.setScalar(this.transform.scale);
    this.exhibitionRoot.rotation.set(0, 0, this.transform.rotation);
  }

  private readonly handleDeviceOrientation = (
    event: DeviceOrientationEvent,
  ): void => {
    if (
      !this.wallPlaced ||
      event.alpha === null ||
      event.beta === null ||
      event.gamma === null
    ) {
      return;
    }

    const current = createDeviceOrientationQuaternion({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      screenAngle: window.screen.orientation?.angle ?? 0,
    });
    if (this.orientationReference === null) {
      this.orientationReference = current;
      this.camera.quaternion.identity();
      return;
    }

    this.camera.quaternion.copy(
      createRelativeDeviceOrientation(this.orientationReference, current),
    );
  };

  private getTrackingMode(): FallbackTrackingMode {
    return this.orientationAccess === "granted" ? "orientation" : "manual";
  }

  private readonly handleResize = (): void => {
    if (this.disposed) {
      return;
    }
    const { width, height } = this.getViewportSize();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(getRendererPixelRatio(window.devicePixelRatio));
    this.renderer.setSize(width, height, false);
  };

  private getViewportSize(): { width: number; height: number } {
    return {
      width: Math.max(1, this.container.clientWidth),
      height: Math.max(1, this.container.clientHeight),
    };
  }
}

function getDeviceOrientationRequester():
  | DeviceOrientationPermissionRequester
  | undefined {
  if (typeof DeviceOrientationEvent === "undefined") {
    return undefined;
  }
  return DeviceOrientationEvent as typeof DeviceOrientationEvent &
    DeviceOrientationPermissionRequester;
}
