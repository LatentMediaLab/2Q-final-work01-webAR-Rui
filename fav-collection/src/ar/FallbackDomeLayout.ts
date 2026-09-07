import * as THREE from "three";
import { createSeededRandom, hashStringToSeed } from "../utils/seededRandom";

export interface FallbackDomeLayoutConfig {
  readonly radius: number;
  readonly horizontalAngleDegrees: number;
  readonly verticalAngleDegrees: number;
  readonly columns: number;
  readonly rows: number;
  readonly cardScale: number;
  readonly imageScaleMultiplier: number;
  readonly textCharactersPerLine: number;
  readonly horizontalJitterDegrees: number;
  readonly verticalJitterDegrees: number;
  readonly verticalOffset: number;
}

export interface FallbackDomePose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: number;
}

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);

export function createFallbackDomeLayout(
  itemKeys: readonly string[],
  cameraPosition: THREE.Vector3,
  cameraQuaternion: THREE.Quaternion,
  config: FallbackDomeLayoutConfig,
): FallbackDomePose[] {
  const count = itemKeys.length;
  if (count === 0) {
    return [];
  }

  const columns = Math.max(1, Math.floor(config.columns));
  const configuredRows = Math.max(1, Math.floor(config.rows));
  const usedRows = Math.ceil(count / columns);
  const rowSlots = Math.max(configuredRows, usedRows);
  const radius = Math.max(0.01, config.radius);
  const horizontalAngle = THREE.MathUtils.degToRad(
    config.horizontalAngleDegrees,
  );
  const verticalAngle = THREE.MathUtils.degToRad(config.verticalAngleDegrees);
  const jitterOffsets = createCenteredJitterOffsets(itemKeys, config);
  const forward = LOCAL_FORWARD.clone().applyQuaternion(cameraQuaternion);
  const right = LOCAL_RIGHT.clone().applyQuaternion(cameraQuaternion);
  const up = LOCAL_UP.clone().applyQuaternion(cameraQuaternion);
  const layoutOrigin = cameraPosition
    .clone()
    .addScaledVector(up, config.verticalOffset);
  const rowOffset = (rowSlots - usedRows) / 2;

  return Array.from({ length: count }, (_unused, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const itemsInRow = Math.min(columns, count - row * columns);
    const columnOffset = (columns - itemsInRow) / 2;
    const theta = angleForSlot(
      column + columnOffset,
      columns,
      horizontalAngle,
    ) + (jitterOffsets[index]?.horizontal ?? 0);
    const phi =
      -angleForSlot(row + rowOffset, rowSlots, verticalAngle) +
      (jitterOffsets[index]?.vertical ?? 0);
    const direction = forward
      .clone()
      .multiplyScalar(Math.cos(theta) * Math.cos(phi))
      .addScaledVector(right, Math.sin(theta) * Math.cos(phi))
      .addScaledVector(up, Math.sin(phi))
      .normalize();
    const position = layoutOrigin.clone().addScaledVector(direction, radius);
    const facingObject = new THREE.Object3D();
    facingObject.position.copy(position);
    facingObject.lookAt(cameraPosition);

    return {
      position,
      quaternion: facingObject.quaternion.clone(),
      scale: Math.max(0.01, config.cardScale),
    };
  });
}

function createCenteredJitterOffsets(
  itemKeys: readonly string[],
  config: FallbackDomeLayoutConfig,
): Array<{ horizontal: number; vertical: number }> {
  const horizontalAmount = THREE.MathUtils.degToRad(
    Math.max(0, config.horizontalJitterDegrees),
  );
  const verticalAmount = THREE.MathUtils.degToRad(
    Math.max(0, config.verticalJitterDegrees),
  );
  const offsets = itemKeys.map((key, index) => {
    const random = createSeededRandom(
      hashStringToSeed(`fallback-dome:${key}:${index}`),
    );
    return {
      horizontal: (random() * 2 - 1) * horizontalAmount,
      vertical: (random() * 2 - 1) * verticalAmount,
    };
  });
  const divisor = Math.max(1, offsets.length);
  const meanHorizontal =
    offsets.reduce((sum, offset) => sum + offset.horizontal, 0) / divisor;
  const meanVertical =
    offsets.reduce((sum, offset) => sum + offset.vertical, 0) / divisor;

  return offsets.map((offset) => ({
    horizontal: offset.horizontal - meanHorizontal,
    vertical: offset.vertical - meanVertical,
  }));
}

function angleForSlot(slot: number, slotCount: number, totalAngle: number): number {
  if (slotCount <= 1) {
    return 0;
  }
  return (slot / (slotCount - 1) - 0.5) * totalAngle;
}
