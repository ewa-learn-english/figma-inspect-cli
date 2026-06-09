import { getFileNode } from "./get-file-node.js";
import type { GetNodeComponentSetOptions } from "./types.js";

export interface ComponentSetEntry {
  key?: string;
  name?: string;
}

export interface ComponentEntry {
  key?: string;
  name?: string;
  componentSetId?: string;
}

export interface ComponentSetContext {
  tree: Record<string, unknown>;
  componentSets: Record<string, ComponentSetEntry>;
  components: Record<string, ComponentEntry>;
}

interface DocumentNode {
  id?: string;
  type?: string;
  children?: DocumentNode[];
}

interface NodeEntry {
  document?: DocumentNode;
  componentSets?: Record<string, ComponentSetEntry>;
  components?: Record<string, ComponentEntry>;
}

interface FileNodesResponse {
  nodes?: Record<string, NodeEntry>;
}

function findDocumentNode(
  root: DocumentNode | undefined,
  targetId: string,
  targetType: string,
): DocumentNode | undefined {
  if (!root) {
    return undefined;
  }

  if (root.id === targetId && root.type === targetType) {
    return root;
  }

  if (!Array.isArray(root.children)) {
    return undefined;
  }

  for (const child of root.children) {
    const found = findDocumentNode(child, targetId, targetType);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function resolveComponentSetId(
  componentSets: Record<string, ComponentSetEntry>,
  componentSetKey: string | undefined,
  componentSetName: string | undefined,
  nodeId: string,
): string {
  if (componentSetKey) {
    for (const [id, entry] of Object.entries(componentSets)) {
      if (entry.key === componentSetKey) {
        return id;
      }
    }

    throw new Error(
      `No component set with key ${componentSetKey} found in node ${nodeId}.`,
    );
  }

  const matches = Object.entries(componentSets).filter(
    ([, entry]) => entry.name === componentSetName,
  );

  if (matches.length === 0) {
    throw new Error(
      `No component set with name "${componentSetName}" found in node ${nodeId}.`,
    );
  }

  if (matches.length > 1) {
    const ids = matches.map(([id]) => id).join(", ");
    throw new Error(
      `Multiple component sets named "${componentSetName}" found in node ${nodeId}: ${ids}. Use --component-set-key instead.`,
    );
  }

  return matches[0][0];
}

function assertComponentSetLookupOptions(
  componentSetKey: string | undefined,
  componentSetName: string | undefined,
): void {
  if (componentSetKey && componentSetName) {
    throw new Error("Pass either componentSetKey or componentSetName, not both.");
  }

  if (!componentSetKey && !componentSetName) {
    throw new Error("Missing componentSetKey or componentSetName.");
  }
}

export async function loadComponentSetContext({
  token,
  fileKey,
  nodeId,
  componentSetKey,
  componentSetName,
  fetchImpl,
}: GetNodeComponentSetOptions): Promise<ComponentSetContext> {
  assertComponentSetLookupOptions(componentSetKey, componentSetName);

  const payload = (await getFileNode({
    token,
    fileKey,
    nodeId,
    fetchImpl,
  })) as FileNodesResponse;

  const nodeEntry = payload.nodes?.[nodeId];
  const componentSets = nodeEntry?.componentSets;
  if (!componentSets) {
    throw new Error(`No component sets found for node ${nodeId}.`);
  }

  const componentSetId = resolveComponentSetId(
    componentSets,
    componentSetKey,
    componentSetName,
    nodeId,
  );

  const documentNode = findDocumentNode(
    nodeEntry.document,
    componentSetId,
    "COMPONENT_SET",
  );

  if (!documentNode) {
    throw new Error(
      `Component set ${componentSetId} not found in document tree for node ${nodeId}.`,
    );
  }

  return {
    tree: documentNode as Record<string, unknown>,
    componentSets,
    components: nodeEntry.components ?? {},
  };
}

export async function getNodeComponentSet(
  options: GetNodeComponentSetOptions,
): Promise<Record<string, unknown>> {
  const { tree } = await loadComponentSetContext(options);
  return tree;
}
