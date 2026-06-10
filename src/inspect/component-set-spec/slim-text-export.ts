import { isRecord } from "./figma-node.js";
import type { SlimDimension, SlimText } from "./types.js";

const LITERAL_TEXT_FIELDS = new Set<string>([
  "align",
  "verticalAlign",
  "autoResize",
]);

export type SlimTextExportKind = "skip" | "literal" | "fill" | "token";

export function slimTextExportKind(key: string): SlimTextExportKind {
  if (key === "content") {
    return "skip";
  }
  if (key === "color") {
    return "fill";
  }
  if (LITERAL_TEXT_FIELDS.has(key)) {
    return "literal";
  }
  return "token";
}

function extractBoundToken(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (typeof value.token === "string" && value.token.length > 0) {
    return value.token;
  }
  return undefined;
}

export function compactBoundTypography(
  value: string | number | SlimDimension | undefined,
  compact: (
    value: string | number | SlimDimension | undefined,
  ) => string | number | SlimDimension | undefined,
): SlimDimension | undefined {
  const compacted = compact(value);
  if (compacted === undefined) {
    return undefined;
  }
  if (typeof compacted === "number" || typeof compacted === "string") {
    return undefined;
  }
  if (typeof compacted.token === "string") {
    return { token: compacted.token };
  }
  return undefined;
}

export function extractTextVisuals(
  text: SlimText,
  extractFillToken: (value: unknown) => string | number | undefined,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(text)) {
    if (value === undefined) {
      continue;
    }

    switch (slimTextExportKind(key)) {
      case "skip":
        break;
      case "fill": {
        const token = extractFillToken(value);
        if (token !== undefined) {
          props[key] = token;
        }
        break;
      }
      case "literal":
        if (typeof value === "string") {
          props[key] = value;
        }
        break;
      case "token": {
        const token = extractBoundToken(value);
        if (token !== undefined) {
          props[key] = token;
        }
        break;
      }
    }
  }

  return props;
}

export { extractBoundToken };
