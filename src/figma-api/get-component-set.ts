import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import { parseComponentSetMetadataResponse } from "./schemas.js";
import type { GetComponentSetOptions } from "./types.js";

export async function getComponentSetByKey({
  token,
  componentSetKey,
  fetchImpl = fetch,
}: GetComponentSetOptions): Promise<
  ReturnType<typeof parseComponentSetMetadataResponse>
> {
  const payload = await figmaRequest(
    `${FIGMA_API_BASE_URL}/component_sets/${encodeURIComponent(componentSetKey)}`,
    token,
    fetchImpl,
  );

  return parseComponentSetMetadataResponse(payload);
}
