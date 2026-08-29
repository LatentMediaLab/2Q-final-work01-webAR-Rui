import * as THREE from "three";
import { APP_CONFIG } from "../app/config";
import type { PostRecord } from "../data/PostTypes";
import { PostRaycaster } from "../interaction/PostRaycaster";
import { Exhibition } from "../scene/Exhibition";
import {
  getRendererPixelRatio,
  shouldUseAntialias,
} from "../scene/rendererPerformance";
import {
  reduceArPlacementState,
  type ArPlacementState,
} from "./ArState";
import { HitTestController } from "./HitTestController";
import { getTargetRay, resolveWallPlacement } from "./placement";
import { Reticle } from "./Reticle";

interface WebXRSceneManagerOptions {
  readonly onPlacementStateChange: (state: ArPlacementState) => void;
  readonly onPostSelected: (postId: string) => void;
  readonly onSessionEnded: (expected: boolean) => void;
}

export class WebXRSceneManager {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly exhibition = new Exhibition();
  private readonly reticle = new Reticle();
  private readonly hitTest = new HitTestController();
  private readonly postRaycaster = new PostRaycaster();
  private session: XRSession | null = null;
  private referenceSpace: XRReferenceSpace | null = null;
  private placementState: ArPlacementState = "loading";
  private disposed = false;
  private sessionEndRequested = false;

  public constructor(
    private readonly container: HTMLElement,
    private readonly options: WebXRSceneManagerOptions,
  ) {
    const { width, height } = this.getViewportSize();
    this.camera = new THREE.PerspectiveCamera(
      50,
      width / height,
      APP_CONFIG.ar.cameraNear,
      APP_CONFIG.ar.cameraFar,
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: shouldUseAntialias(window.devicePixelRatio),
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(getRendererPixelRatio(window.devicePixelRatio));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "preview-canvas ar-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType("local");
    this.container.append(this.renderer.domElement);

    const hemisphereLight = new THREE.HemisphereLight(0xfff6df, 0x302b24, 1.8);
    const directionalLight = new THREE.DirectionalLight(0xffecd0, 1.25);
    directionalLight.position.set(1.8, 2.4, 3.5);
    this.scene.add(hemisphereLight, directionalLight);

    this.exhibition.setVisible(false);
    this.scene.add(this.exhibition.group, this.reticle.group);
    window.addEventListener("resize", this.handleResize);
  }

  public async startSession(session: XRSession): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.session = session;
    this.sessionEndRequested = false;
    session.addEventListener("end", this.handleSessionEnd);
    session.addEventListener("select", this.handleSelect);

    const referenceSpace = await requestPreferredReferenceSpace(session);
    await this.renderer.xr.setSession(session);
    this.renderer.xr.setReferenceSpace(referenceSpace);
    this.referenceSpace = referenceSpace;
    await this.hitTest.initialize(session, referenceSpace);
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  public async load(posts: readonly PostRecord[]): Promise<void> {
    if (this.disposed) {
      return;
    }
    await this.exhibition.load(posts);
    if (this.disposed) {
      return;
    }
    this.setPlacementState(
      reduceArPlacementState(this.placementState, { type: "data-loaded" }),
    );
  }

  public setCaptionsVisible(visible: boolean): void {
    this.exhibition.setCaptionsVisible(visible);
  }

  public startRepositioning(): void {
    if (this.placementState !== "placed") {
      return;
    }
    this.exhibition.setVisible(false);
    this.reticle.hide();
    this.setPlacementState(
      reduceArPlacementState(this.placementState, { type: "reposition" }),
    );
  }

  public async endSession(): Promise<void> {
    const session = this.session;
    if (session === null) {
      return;
    }
    this.sessionEndRequested = true;
    try {
      await session.end();
    } catch (error: unknown) {
      this.sessionEndRequested = false;
      console.warn("[Fav Collection] ARセッションを終了できませんでした。", error);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const activeSession = this.session;
    window.removeEventListener("resize", this.handleResize);
    this.releaseSessionResources();
    if (activeSession !== null) {
      void activeSession.end().catch((error: unknown) => {
        console.warn("[Fav Collection] ARセッションを破棄できませんでした。", error);
      });
    }
    this.exhibition.dispose();
    this.reticle.dispose();
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement === this.container) {
      this.renderer.domElement.remove();
    }
  }

  private readonly renderFrame: XRFrameRequestCallback = (_time, frame): void => {
    if (this.disposed) {
      return;
    }

    if (this.placementState === "scanning" || this.placementState === "ready") {
      const pose = this.hitTest.update(frame);
      const viewerPosition = this.getViewerPosition(frame);
      this.reticle.update(pose, viewerPosition);
      const nextState = reduceArPlacementState(this.placementState, {
        type: pose === null ? "hit-lost" : "hit-found",
      });
      this.setPlacementState(nextState);
    } else {
      this.reticle.hide();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleSelect = (event: XRInputSourceEvent): void => {
    const referenceSpace = this.referenceSpace;
    if (referenceSpace === null) {
      return;
    }

    if (this.placementState === "ready") {
      const hitPose = this.hitTest.update(event.frame);
      if (hitPose === null) {
        this.reticle.hide();
        this.setPlacementState("scanning");
        return;
      }

      const placement = resolveWallPlacement(
        hitPose.transform.matrix,
        this.getViewerPosition(event.frame),
        APP_CONFIG.ar.wallOffset,
      );
      this.exhibition.group.position.copy(placement.position);
      this.exhibition.group.quaternion.copy(placement.quaternion);
      this.exhibition.setVisible(true);
      this.reticle.hide();
      this.setPlacementState(
        reduceArPlacementState(this.placementState, { type: "place" }),
      );
      return;
    }

    if (this.placementState !== "placed") {
      return;
    }

    const targetPose = event.frame.getPose(
      event.inputSource.targetRaySpace,
      referenceSpace,
    );
    if (targetPose === undefined) {
      return;
    }
    const ray = getTargetRay(targetPose.transform.matrix);
    const postId = this.postRaycaster.pickPostIdFromRay(
      ray.origin,
      ray.direction,
      this.exhibition.getSelectableObjects(),
    );
    if (postId !== null) {
      this.options.onPostSelected(postId);
    }
  };

  private readonly handleSessionEnd = (): void => {
    const expected = this.sessionEndRequested;
    this.releaseSessionResources();
    this.options.onSessionEnded(expected);
  };

  private releaseSessionResources(): void {
    const session = this.session;
    if (session !== null) {
      session.removeEventListener("end", this.handleSessionEnd);
      session.removeEventListener("select", this.handleSelect);
    }
    this.session = null;
    this.sessionEndRequested = false;
    this.referenceSpace = null;
    this.hitTest.dispose();
    this.reticle.hide();
    this.renderer.setAnimationLoop(null);
    if (this.renderer.xr.getSession() !== null) {
      void this.renderer.xr.setSession(null).catch((error: unknown) => {
        console.warn("[Fav Collection] XRレンダラーを解除できませんでした。", error);
      });
    }
  }

  private setPlacementState(state: ArPlacementState): void {
    if (state === this.placementState) {
      return;
    }
    this.placementState = state;
    this.options.onPlacementStateChange(state);
  }

  private getViewerPosition(frame: XRFrame): THREE.Vector3 {
    const viewerPose =
      this.referenceSpace === null
        ? undefined
        : frame.getViewerPose(this.referenceSpace);
    if (viewerPose === undefined) {
      return this.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
    }
    const position = viewerPose.transform.position;
    return new THREE.Vector3(position.x, position.y, position.z);
  }

  private readonly handleResize = (): void => {
    if (this.disposed || this.renderer.xr.isPresenting) {
      return;
    }
    const { width, height } = this.getViewportSize();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private getViewportSize(): { width: number; height: number } {
    return {
      width: Math.max(1, this.container.clientWidth),
      height: Math.max(1, this.container.clientHeight),
    };
  }
}

async function requestPreferredReferenceSpace(
  session: XRSession,
): Promise<XRReferenceSpace> {
  try {
    return await session.requestReferenceSpace("local-floor");
  } catch (error: unknown) {
    console.info(
      "[Fav Collection] local-floorを利用できないためlocalを使用します。",
      error,
    );
    return session.requestReferenceSpace("local");
  }
}
