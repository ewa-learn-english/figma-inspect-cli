import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import { type FigmaPage, parseFilePagesResponse } from "./schemas.js";
import type { ListFilePagesOptions } from "./types.js";

export async function listFilePages({
  token,
  fileKey,
  fetchImpl = fetch,
}: ListFilePagesOptions): Promise<FigmaPage[]> {
  const url = new URL(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}`,
  );
  url.searchParams.set("depth", "1");

  const payload = await figmaRequest(url, token, fetchImpl);
  return parseFilePagesResponse(payload);
}
