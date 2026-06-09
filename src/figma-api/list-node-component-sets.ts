import { getFileNode } from "./get-file-node.js";
import type {
  FigmaComponentSet,
  ListNodeComponentSetsOptions,
} from "./types.js";

interface ComponentSetEntry {
  key?: string;
  name?: string;
}

interface NodeEntry {
  componentSets?: Record<string, ComponentSetEntry>;
}

interface FileNodesResponse {
  nodes?: Record<string, NodeEntry>;
}

export async function listNodeComponentSets({
  token,
  fileKey,
  nodeId,
  fetchImpl,
}: ListNodeComponentSetsOptions): Promise<FigmaComponentSet[]> {
  const payload = (await getFileNode({
    token,
    fileKey,
    nodeId,
    fetchImpl,
  })) as FileNodesResponse;

  const componentSets = payload.nodes?.[nodeId]?.componentSets;
  if (!componentSets) {
    return [];
  }

  return Object.entries(componentSets)
    .map(([id, set]) => ({
      id,
      key: String(set.key ?? ""),
      name: String(set.name ?? ""),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
