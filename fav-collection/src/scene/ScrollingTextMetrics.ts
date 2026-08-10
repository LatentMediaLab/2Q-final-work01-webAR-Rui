import { APP_CONFIG } from "../app/config";

export interface ScrollingTextMetrics {
  readonly lines: readonly string[];
  readonly width: number;
  readonly height: number;
}

export function createScrollingTextLines(
  authorHandle: string,
  text: string,
): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  const contentLines = lines.length === 0 ? [""] : lines;
  const firstLine = contentLines[0] ?? "";
  return [`${authorHandle}\u3000${firstLine}`, ...contentLines.slice(1)];
}

export function getScrollingTextMetrics(
  authorHandle: string,
  text: string,
): ScrollingTextMetrics {
  const lines = createScrollingTextLines(authorHandle, text);
  const longestLineUnits = Math.max(
    0,
    ...lines.map((line) => measureCharacterUnits(line)),
  );
  const textWidth = longestLineUnits * APP_CONFIG.layout.textCharacterWidth;
  const textHeight =
    lines.length * APP_CONFIG.layout.textLineHeight +
    APP_CONFIG.layout.textVerticalPadding;

  return {
    lines,
    width: clamp(
      textWidth + APP_CONFIG.layout.textHorizontalPadding,
      APP_CONFIG.layout.textPanelMinWidth,
      APP_CONFIG.layout.textPanelMaxWidth,
    ),
    height: clamp(
      textHeight,
      APP_CONFIG.layout.textLineHeight +
        APP_CONFIG.layout.textVerticalPadding,
      APP_CONFIG.layout.textPanelMaxHeight,
    ),
  };
}

export function measureCharacterUnits(value: string): number {
  return Array.from(value).reduce((total, character) => {
    if (/\p{Mark}/u.test(character) || character === "\uFE0F") {
      return total;
    }
    if (/\s/u.test(character)) {
      return total + 0.5;
    }
    if (/^[\x20-\x7E]$/u.test(character)) {
      return total + 0.58;
    }
    return total + 1;
  }, 0);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
