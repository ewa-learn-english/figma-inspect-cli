import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import {
  type FigmaPublishedComponentSet,
  parseFileComponentSetsResponse,
} from "./schemas.js";
import type { ListFileComponentSetsOptions } from "./types.js";

export async function listFileComponentSets({
  token,
  fileKey,
  fetchImpl = fetch,
}: ListFileComponentSetsOptions): Promise<FigmaPublishedComponentSet[]> {
  const payload = await figmaRequest(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}/component_sets`,
    token,
    fetchImpl,
  );

  return parseFileComponentSetsResponse(payload);
}
