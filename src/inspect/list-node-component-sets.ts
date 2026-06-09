import { fetchFileNodeEntry } from "./parse-file-nodes-response.js";
import type {
  FigmaComponentSet,
  ListNodeComponentSetsOptions,
} from "./types.js";

export async function listNodeComponentSets({
  token,
  fileKey,
  nodeId,
  fetchImpl,
}: ListNodeComponentSetsOptions): Promise<FigmaComponentSet[]> {
  const nodeEntry = await fetchFileNodeEntry({
    token,
    fileKey,
    nodeId,
    fetchImpl,
  });

  return Object.entries(nodeEntry.componentSets)
    .map(([id, set]) => ({
      id,
      key: set.key ?? "",
      name: set.name ?? "",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
