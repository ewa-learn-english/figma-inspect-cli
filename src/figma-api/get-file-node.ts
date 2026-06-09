import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import type { GetFileNodeOptions } from "./types.js";

export async function getFileNode({
  token,
  fileKey,
  nodeId,
  fetchImpl = fetch,
}: GetFileNodeOptions): Promise<unknown> {
  const url = new URL(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}/nodes`,
  );
  url.searchParams.set("ids", nodeId);

  return figmaRequest(url, token, fetchImpl);
}
