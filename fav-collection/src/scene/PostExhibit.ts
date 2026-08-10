import type * as THREE from "three";

export interface PostExhibit {
  readonly group: THREE.Group;
  load(): Promise<void>;
  update(deltaSeconds: number): void;
  setTextAnimationPaused(paused: boolean): void;
  setCaptionsVisible(visible: boolean): void;
  dispose(): void;
}
