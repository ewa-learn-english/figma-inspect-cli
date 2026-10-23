import { FigmaInspectError } from "../errors.js";
import { assertExportedSvgBytes } from "./assert-asset-exportable.js";
import { normalizeExportedSvgBytes } from "./normalize-exported-svg.js";

export type RenderedImageFormat = "webp" | "svg";

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

export async function normalizeRenderedImageBytes(
  bytes: Uint8Array,
  format: RenderedImageFormat,
  context: string,
  artifact: string,
): Promise<Uint8Array> {
  if (format === "svg") {
    assertExportedSvgBytes(bytes, context);
    return normalizeExportedSvgBytes(bytes);
  }

  assertExportedPngBytes(bytes, context, artifact);

  try {
    const { default: sharp } = await import("sharp");
    const image = sharp(bytes);
    const metadata = await image.metadata();
    if ((metadata.bitsPerSample ?? 8) > 8) {
      throw new Error("WebP cannot preserve PNG samples deeper than 8 bits.");
    }

    // Lossless quality controls effort; exact also preserves transparent RGB.
    return await image
      .keepIccProfile()
      .webp({ lossless: true, exact: true, quality: 75, effort: 4 })
      .toBuffer();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new FigmaInspectError(
      `Cannot encode WebP ${artifact} for ${context}: ${reason}`,
    );
  }
}
