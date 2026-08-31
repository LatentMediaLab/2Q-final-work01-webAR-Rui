import * as THREE from "three";
import {
  createImagePostBodyLines,
  IMAGE_POST_BODY_MAX_LINES,
} from "./ImagePostBodyText";
import { createTextPostLines } from "./ScrollingTextMetrics";

const FONT_FAMILY =
  '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif';
const fallbackTextures = new Map<string, THREE.CanvasTexture>();

export function createFallbackTexture(label: string): THREE.CanvasTexture {
  const cached = fallbackTextures.get(label);
  if (cached !== undefined) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const context = getContext(canvas);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#e6e5ef");
  gradient.addColorStop(1, "#ced7dc");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(0, 33, 59, 0.22)";
  context.lineWidth = 5;
  for (let offset = -canvas.height; offset < canvas.width; offset += 42) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + canvas.height, canvas.height);
    context.stroke();
  }

  context.strokeStyle = "#00213b";
  context.lineWidth = 6;
  context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
  context.fillStyle = "#00213b";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 36px ${FONT_FAMILY}`;
  context.fillText(label, canvas.width / 2, canvas.height / 2 - 14);
  context.font = `400 19px ${FONT_FAMILY}`;
  context.fillText("素材を読み込めませんでした", canvas.width / 2, canvas.height / 2 + 38);

  const texture = createCanvasTexture(canvas);
  texture.userData.sharedResource = true;
  fallbackTextures.set(label, texture);
  return texture;
}

export function createCaptionTexture(
  authorHandle: string,
  viewCount: number | undefined,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const context = getContext(canvas);
  context.fillStyle = "rgba(0, 33, 59, 0.92)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e6e5ef";
  context.textBaseline = "middle";
  context.font = `600 21px ${FONT_FAMILY}`;
  context.fillText(authorHandle, 18, canvas.height / 2);
  context.textAlign = "right";
  context.font = `400 16px ${FONT_FAMILY}`;
  context.fillStyle = "#ced7dc";
  context.fillText(
    `${formatCount(viewCount ?? 0)} views`,
    canvas.width - 18,
    canvas.height / 2,
  );

  return createCanvasTexture(canvas);
}

export function createImagePostBodyTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 320;
  const context = getContext(canvas);
  const lines = createImagePostBodyLines(text);
  const horizontalPadding = 42;
  const verticalPadding = 30;
  const lineHeight =
    (canvas.height - verticalPadding * 2) / IMAGE_POST_BODY_MAX_LINES;

  context.fillStyle = "#e6e5ef";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#00213b";
  context.textBaseline = "middle";
  context.font = `500 32px ${FONT_FAMILY}`;

  lines.forEach((line, index) => {
    context.fillText(
      line,
      horizontalPadding,
      verticalPadding + (index + 0.5) * lineHeight,
      canvas.width - horizontalPadding * 2,
    );
  });

  return createCanvasTexture(canvas);
}

export function createTextPostTexture(
  authorName: string,
  text: string,
): THREE.CanvasTexture {
  const lines = createTextPostLines(authorName, text);
  const canvas = document.createElement("canvas");
  const measuringContext = getContext(canvas);
  const authorFontSize = 28;
  const bodyFontSize = 26;
  const horizontalPadding = 32;
  const verticalPadding = 40;
  const lineHeight = 40;
  const maximumWidth = 4_096;
  const minimumWidth = 640;
  const measuredWidths = lines.map((line, index) => {
    measuringContext.font = `${index === 0 ? 700 : 500} ${
      index === 0 ? authorFontSize : bodyFontSize
    }px ${FONT_FAMILY}`;
    return measuringContext.measureText(line).width;
  });
  const measuredWidth = Math.max(0, ...measuredWidths);
  canvas.width = Math.min(
    maximumWidth,
    Math.max(minimumWidth, Math.ceil(measuredWidth + horizontalPadding * 2)),
  );
  canvas.height = Math.max(80, lineHeight * lines.length + verticalPadding);

  const context = getContext(canvas);
  context.fillStyle = "rgba(230, 229, 239, 0.5)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(0, 33, 59, 0.18)";
  context.lineWidth = 2;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = "#00213b";
  context.textBaseline = "middle";
  const maximumTextWidth = canvas.width - horizontalPadding * 2;
  lines.forEach((line, index) => {
    const lineWidth = measuredWidths[index] ?? 0;
    const y = verticalPadding / 2 + (index + 0.5) * lineHeight;
    context.font = `${index === 0 ? 700 : 500} ${
      index === 0 ? authorFontSize : bodyFontSize
    }px ${FONT_FAMILY}`;
    if (lineWidth <= maximumTextWidth) {
      context.fillText(line, horizontalPadding, y);
      return;
    }

    context.save();
    context.translate(horizontalPadding, y);
    context.scale(maximumTextWidth / lineWidth, 1);
    context.fillText(line, 0, 0);
    context.restore();
  });

  return createCanvasTexture(canvas);
}

export function disposeSharedCanvasTextures(): void {
  fallbackTextures.forEach((texture) => texture.dispose());
  fallbackTextures.clear();
}

function createCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  return context;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}
