import { fetchFileNodeEntry } from "./fetch-file-node-entry.js";
import type { FigmaComponentSet } from "./schemas.js";
import type { ListNodeComponentSetsOptions } from "./types.js";

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

  return Object.values(nodeEntry.componentSets).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
