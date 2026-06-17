import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadRenderedImage,
  getFileImageUrls,
} from "../../figma-api/get-file-images.js";
import { FigmaInspectError } from "../errors.js";
import type { NodeContractKind } from "../node-contract/types.js";
import { assertExportedSvgBytes } from "./assert-asset-exportable.js";
import { normalizeExportedSvgBytes } from "./normalize-exported-svg.js";

export const DEFAULT_PREVIEW_SCALE = 2;

export type PreviewFormat = "png" | "svg";

export type ExportPreviewOptions =
  | { format: "png"; scale: number }
  | { format: "svg" };

export interface ExportNodePreviewOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  baseName: string;
  kind: "component-set" | NodeContractKind;
  outputDir: string;
  preview: ExportPreviewOptions;
  fetchImpl?: typeof fetch;
}

export interface ExportNodePreviewResult {
  previewPath: string;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function assertPreviewScale(scale: number): void {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new FigmaInspectError("Preview scale must be a positive number.");
  }
}

function assertExportedPngBytes(bytes: Uint8Array, context: string): void {
  const hasPngSignature = PNG_SIGNATURE.every(
    (value, index) => bytes[index] === value,
  );

  if (!hasPngSignature) {
    throw new FigmaInspectError(`Exported preview for ${context} is not PNG.`);
  }
}

function previewScale(preview: ExportPreviewOptions): number | undefined {
  if (preview.format === "png") {
    assertPreviewScale(preview.scale);
    return preview.scale;
  }

  return undefined;
}

function resolveNodePreviewPath(
  directory: string,
  baseName: string,
  kind: "component-set" | NodeContractKind,
  format: PreviewFormat,
): string {
  return path.join(directory, `${baseName}.${kind}.preview.${format}`);
}

function normalizePreviewBytes(
  bytes: Uint8Array,
  preview: ExportPreviewOptions,
  nodeId: string,
): Uint8Array {
  if (preview.format === "svg") {
    assertExportedSvgBytes(bytes, `preview ${nodeId}`);
    return normalizeExportedSvgBytes(bytes);
  }

  assertExportedPngBytes(bytes, nodeId);
  return bytes;
}

export async function exportNodePreview(
  options: ExportNodePreviewOptions,
): Promise<ExportNodePreviewResult> {
  const imageUrls = await getFileImageUrls({
    token: options.token,
    fileKey: options.fileKey,
    nodeIds: [options.nodeId],
    format: options.preview.format,
    scale: previewScale(options.preview),
    fetchImpl: options.fetchImpl,
  });
  const rawBytes = await downloadRenderedImage(
    imageUrls[options.nodeId],
    options.fetchImpl,
  );
  const previewPath = resolveNodePreviewPath(
    options.outputDir,
    options.baseName,
    options.kind,
    options.preview.format,
  );

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(
    previewPath,
    normalizePreviewBytes(rawBytes, options.preview, options.nodeId),
  );

  return { previewPath };
}
