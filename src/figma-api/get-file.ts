import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import type { GetFileOptions } from "./types.js";

export async function getFile({
  token,
  fileKey,
  fetchImpl = fetch,
}: GetFileOptions): Promise<unknown> {
  return figmaRequest(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}`,
    token,
    fetchImpl,
  );
}
