import { measureCharacterUnits } from "./ScrollingTextMetrics";

export const IMAGE_POST_BODY_MAX_LINES = 2;
const IMAGE_POST_BODY_MAX_UNITS_PER_LINE = 22;

export function hasImagePostBody(text: string): boolean {
  return text.trim().length > 0;
}

export function createImagePostBodyLines(text: string): string[] {
  if (!hasImagePostBody(text)) {
    return [];
  }

  const lines: string[] = [];
  let truncated = false;
  const sourceLines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");

  for (const [sourceLineIndex, sourceLine] of sourceLines.entries()) {
    const characters = [...sourceLine];
    let line = "";

    if (characters.length === 0) {
      if (lines.length < IMAGE_POST_BODY_MAX_LINES) {
        lines.push("");
      } else {
        truncated = true;
        break;
      }
      continue;
    }

    for (const character of characters) {
      const candidate = `${line}${character}`;
      if (
        line.length > 0 &&
        measureCharacterUnits(candidate) > IMAGE_POST_BODY_MAX_UNITS_PER_LINE
      ) {
        lines.push(line);
        if (lines.length === IMAGE_POST_BODY_MAX_LINES) {
          truncated = true;
          break;
        }
        line = character;
      } else {
        line = candidate;
      }
    }

    if (truncated) {
      break;
    }
    if (line.length > 0) {
      lines.push(line);
      if (lines.length === IMAGE_POST_BODY_MAX_LINES) {
        const hasRemainingSourceLine = sourceLineIndex < sourceLines.length - 1;
        truncated = hasRemainingSourceLine;
        if (truncated) {
          break;
        }
      }
    }
  }

  if (truncated && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const lastLine = lines[lastIndex] ?? "";
    lines[lastIndex] = `${lastLine.replace(/[\s…]+$/u, "")}…`;
  }

  return lines.slice(0, IMAGE_POST_BODY_MAX_LINES);
}
