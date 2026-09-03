import { FIGMA_API_V2_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import { type FigmaFile, parseProjectFilesResponse } from "./schemas.js";
import type { ListProjectFilesOptions } from "./types.js";

export async function listProjectFiles({
  token,
  projectId,
  fetchImpl = fetch,
}: ListProjectFilesOptions): Promise<FigmaFile[]> {
  const payload = await figmaRequest(
    `${FIGMA_API_V2_BASE_URL}/folders/${encodeURIComponent(projectId)}/files`,
    token,
    fetchImpl,
  );

  return parseProjectFilesResponse(payload);
}
