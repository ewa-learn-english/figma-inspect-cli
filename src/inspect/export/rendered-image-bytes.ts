import { FigmaInspectError } from "../errors.js";
import { assertExportedSvgBytes } from "./assert-asset-exportable.js";
import { normalizeExportedSvgBytes } from "./normalize-exported-svg.js";

export type RenderedImageFormat = "png" | "svg";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function assertPositiveScale(scale: number, label: string): void {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new FigmaInspectError(`${label} must be a positive number.`);
  }
}

function assertExportedPngBytes(
  bytes: Uint8Array,
  context: string,
  artifact: string,
): void {
  const hasPngSignature = PNG_SIGNATURE.every(
    (value, index) => bytes[index] === value,
  );

  if (!hasPngSignature) {
    throw new FigmaInspectError(
      `Exported ${artifact} for ${context} is not PNG.`,
    );
  }
}

export function normalizeRenderedImageBytes(
  bytes: Uint8Array,
  format: RenderedImageFormat,
  context: string,
  artifact: string,
): Uint8Array {
  if (format === "svg") {
    assertExportedSvgBytes(bytes, context);
    return normalizeExportedSvgBytes(bytes);
  }

  assertExportedPngBytes(bytes, context, artifact);
  return bytes;
}
