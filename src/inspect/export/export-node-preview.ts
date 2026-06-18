import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadRenderedImage,
  getFileImageUrls,
} from "../../figma-api/get-file-images.js";
import type { NodeContractKind } from "../node-contract/types.js";
import {
  assertPositiveScale,
  normalizeRenderedImageBytes,
} from "./rendered-image-bytes.js";

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

function previewScale(preview: ExportPreviewOptions): number | undefined {
  if (preview.format === "png") {
    assertPositiveScale(preview.scale, "Preview scale");
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
  return normalizeRenderedImageBytes(
    bytes,
    preview.format,
    preview.format === "svg" ? `preview ${nodeId}` : nodeId,
    "preview",
  );
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
