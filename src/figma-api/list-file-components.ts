import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import {
  type FigmaFileComponent,
  parseFileComponentsResponse,
} from "./schemas.js";
import type { ListFileComponentsOptions } from "./types.js";

export async function listFileComponents({
  token,
  fileKey,
  fetchImpl = fetch,
}: ListFileComponentsOptions): Promise<FigmaFileComponent[]> {
  const payload = await figmaRequest(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}/components`,
    token,
    fetchImpl,
  );

  return parseFileComponentsResponse(payload);
}

export function filterFileComponentsForComponentSet(
  components: FigmaFileComponent[],
  componentSetNodeId: string,
): FigmaFileComponent[] {
  return components
    .filter(
      (component) =>
        component.containing_component_set_node_id === componentSetNodeId,
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}
