import { FIGMA_API_BASE_URL } from "./constants.js";
import { FigmaApiError } from "./figma-api-error.js";
import { formatFigmaError } from "./format-figma-error.js";
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

  const response = await fetchImpl(url, {
    headers: {
      "X-FIGMA-TOKEN": token,
    },
  });

  if (!response.ok) {
    throw new FigmaApiError(await formatFigmaError(response));
  }

  return response.json();
}
