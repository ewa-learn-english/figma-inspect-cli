import { FIGMA_API_BASE_URL } from "./constants.js";
import { FigmaApiError } from "./figma-api-error.js";
import { figmaRequest } from "./figma-request.js";
import { parseFileImagesResponse } from "./schemas.js";
import type { GetFileImagesOptions } from "./types.js";

const IMAGE_ID_BATCH_SIZE = 50;

function chunk<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

export async function getFileImageUrls({
  token,
  fileKey,
  nodeIds,
  format,
  scale,
  fetchImpl = fetch,
}: GetFileImagesOptions): Promise<Record<string, string>> {
  const normalizedIds = [...new Set(nodeIds.map((nodeId) => String(nodeId)))];
  if (normalizedIds.length === 0) {
    return {};
  }

  const imageUrls: Record<string, string> = {};

  for (const batch of chunk(normalizedIds, IMAGE_ID_BATCH_SIZE)) {
    const url = new URL(
      `${FIGMA_API_BASE_URL}/images/${encodeURIComponent(fileKey)}`,
    );
    url.searchParams.set("ids", batch.join(","));
    url.searchParams.set("format", format);
    if (format === "png" && scale !== undefined) {
      url.searchParams.set("scale", String(scale));
    }

    const payload = await figmaRequest(url, token, fetchImpl);
    const parsed = parseFileImagesResponse(payload);

    for (const nodeId of batch) {
      const imageUrl = parsed.images[nodeId];
      if (!imageUrl) {
        throw new FigmaApiError(
          `Figma image export returned no URL for node ${nodeId}.`,
        );
      }
      imageUrls[nodeId] = imageUrl;
    }
  }

  return imageUrls;
}

export async function downloadRenderedImage(
  imageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const response = await fetchImpl(imageUrl);
  if (!response.ok) {
    throw new FigmaApiError(
      `Rendered asset download failed: ${response.status} ${response.statusText}.`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}
