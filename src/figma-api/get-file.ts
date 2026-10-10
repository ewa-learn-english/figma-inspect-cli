import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import type { GetFileNodesOptions, GetFileOptions } from "./types.js";

// Whole-file and batched node downloads feed the team index, which tracks
// file versions itself, so they bypass the disk cache.

export async function getFile({
  token,
  fileKey,
  depth,
  maxBytes,
  fetchImpl = fetch,
}: GetFileOptions): Promise<unknown> {
  const url = new URL(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}`,
  );
  if (depth !== undefined) {
    url.searchParams.set("depth", String(depth));
  }

  return figmaRequest(url, token, fetchImpl, { cache: false, maxBytes });
}

export async function getFileNodes({
  token,
  fileKey,
  nodeIds,
  depth,
  maxBytes,
  fetchImpl = fetch,
}: GetFileNodesOptions): Promise<unknown> {
  const url = new URL(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}/nodes`,
  );
  url.searchParams.set("ids", nodeIds.join(","));
  if (depth !== undefined) {
    url.searchParams.set("depth", String(depth));
  }

  return figmaRequest(url, token, fetchImpl, { cache: false, maxBytes });
}
