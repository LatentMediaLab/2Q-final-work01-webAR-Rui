import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { APP_CONFIG } from "../app/config";
import type { PostRecord } from "../data/PostTypes";
import { PostRaycaster } from "../interaction/PostRaycaster";
import { Exhibition } from "./Exhibition";
import {
  getRendererPixelRatio,
  shouldUseAntialias,
} from "./rendererPerformance";

interface SceneManagerOptions {
  readonly onPostSelected: (postId: string) => void;
}

interface PointerStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

export class SceneManager {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly exhibition = new Exhibition();
  private readonly wallGeometry: THREE.PlaneGeometry;
  private readonly wallMaterial: THREE.MeshStandardMaterial;
  private readonly postRaycaster = new PostRaycaster();
  private pointerStart: PointerStart | null = null;
  private disposed = false;

  public constructor(
    private readonly container: HTMLElement,
    private readonly options: SceneManagerOptions,
  ) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe6e5ef);

    const { width, height } = this.getViewportSize();
    this.camera = new THREE.PerspectiveCamera(
      APP_CONFIG.preview.cameraFov,
      width / height,
      APP_CONFIG.preview.cameraNear,
      APP_CONFIG.preview.cameraFar,
    );
    this.camera.position.set(0, 0.12, APP_CONFIG.preview.cameraDistance);

    this.renderer = new THREE.WebGLRenderer({
      antialias: shouldUseAntialias(window.devicePixelRatio),
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(getRendererPixelRatio(window.devicePixelRatio));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "preview-canvas";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "画像、動画、テキストの投稿を配置した仮想壁の3Dプレビュー。Enterキーで中央の投稿を選択できます。",
    );
    this.container.append(this.renderer.domElement);

    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement,
    );
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 8;
    this.controls.update();

    const hemisphereLight = new THREE.HemisphereLight(0xe6e5ef, 0x00213b, 1.8);
    this.scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xe6e5ef, 1.25);
    directionalLight.position.set(1.8, 2.4, 3.5);
    this.scene.add(directionalLight);

    this.wallGeometry = new THREE.PlaneGeometry(
      APP_CONFIG.exhibition.width + 9,
      APP_CONFIG.exhibition.height + 6,
    );
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xced7dc,
      roughness: 0.94,
      metalness: 0,
    });
    const wall = new THREE.Mesh(this.wallGeometry, this.wallMaterial);
    wall.name = "exhibition-wall";
    wall.position.z = -0.08;
    this.scene.add(wall);

    this.scene.add(this.exhibition.group);

    window.addEventListener("resize", this.handleResize);
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.addEventListener(
      "pointercancel",
      this.handlePointerCancel,
    );
    this.renderer.domElement.addEventListener("keydown", this.handleKeyDown);
    this.renderer.setAnimationLoop(this.renderFrame);
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

  public resetCamera(): void {
    this.camera.position.set(0, 0.12, APP_CONFIG.preview.cameraDistance);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    window.removeEventListener("resize", this.handleResize);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );
    this.renderer.domElement.removeEventListener(
      "pointerup",
      this.handlePointerUp,
    );
    this.renderer.domElement.removeEventListener(
      "pointercancel",
      this.handlePointerCancel,
    );
    this.renderer.domElement.removeEventListener("keydown", this.handleKeyDown);
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.exhibition.dispose();
    this.wallGeometry.dispose();
    this.wallMaterial.dispose();
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();

    if (this.renderer.domElement.parentElement === this.container) {
      this.renderer.domElement.remove();
    }
  }

  private readonly renderFrame = (): void => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

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

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    this.pointerStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (start === null || start.pointerId !== event.pointerId) {
      return;
    }

    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      return;
    }

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
  };

  private readonly handlePointerCancel = (): void => {
    this.pointerStart = null;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") {
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
    const keyboardPostId = postId ?? getFirstPostId(selectableObjects);
    if (keyboardPostId !== null) {
      this.options.onPostSelected(keyboardPostId);
    }
  };

  private getViewportSize(): { width: number; height: number } {
    return {
      width: Math.max(1, this.container.clientWidth),
      height: Math.max(1, this.container.clientHeight),
    };
  }
}

function getFirstPostId(objects: readonly THREE.Object3D[]): string | null {
  const postId = objects[0]?.userData.postId;
  return typeof postId === "string" ? postId : null;
}
