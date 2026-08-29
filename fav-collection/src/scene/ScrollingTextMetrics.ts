import { APP_CONFIG } from "../app/config";

export const TEXT_POST_CHARACTERS_PER_LINE = 40;

export interface TextPostMetrics {
  readonly lines: readonly string[];
  readonly width: number;
  readonly height: number;
}

export function createTextPostLines(
  authorName: string,
  text: string,
): string[] {
  const bodyLines = text
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .flatMap(wrapTextLine);

  return [authorName, ...bodyLines];
}

export function getTextPostMetrics(
  authorName: string,
  text: string,
): TextPostMetrics {
  const lines = createTextPostLines(authorName, text);
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
    height: textHeight,
  };
}

function wrapTextLine(line: string): string[] {
  const characters = Array.from(line);
  if (characters.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  for (
    let index = 0;
    index < characters.length;
    index += TEXT_POST_CHARACTERS_PER_LINE
  ) {
    lines.push(
      characters
        .slice(index, index + TEXT_POST_CHARACTERS_PER_LINE)
        .join(""),
    );
  }
  return lines;
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
