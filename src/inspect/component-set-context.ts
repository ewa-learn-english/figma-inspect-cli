import {
  buildLenientNameIndex,
  resolveComponentSetId,
} from "./component-set-lookup.js";
import { FigmaInspectError } from "./errors.js";
import { fetchFileNodeEntry } from "./fetch-file-node-entry.js";
import type {
  ComponentEntry,
  DocumentNode,
  FigmaComponentSet,
} from "./schemas.js";
import type {
  ComponentSetNodeRefOptions,
  ComponentSetScopeOptions,
} from "./types.js";

export interface ComponentSetContext {
  tree: DocumentNode;
  componentSets: Record<string, FigmaComponentSet>;
  components: Record<string, ComponentEntry>;
  nameIndex: Map<string, string>;
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

  if (!root.children) {
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

function assertComponentSetNode(
  node: DocumentNode | undefined,
  nodeId: string,
): DocumentNode {
  if (node?.type !== "COMPONENT_SET") {
    const type = node?.type ?? "UNKNOWN";
    throw new FigmaInspectError(
      `Figma node ${nodeId} is ${type}; expected COMPONENT_SET.`,
    );
  }

  return node;
}

function componentSetContextFromNodeEntry(
  nodeEntry: Awaited<ReturnType<typeof fetchFileNodeEntry>>,
  componentSetNode: DocumentNode,
): ComponentSetContext {
  const nameIndex = buildLenientNameIndex(nodeEntry.componentSets);

  return {
    tree: componentSetNode,
    componentSets: nodeEntry.componentSets,
    components: nodeEntry.components,
    nameIndex,
  };
}

export async function loadComponentSetContext({
  token,
  fileKey,
  nodeId,
  componentSet,
  fetchImpl,
}: ComponentSetScopeOptions): Promise<ComponentSetContext> {
  const nodeEntry = await fetchFileNodeEntry({
    token,
    fileKey,
    nodeId,
    fetchImpl,
  });

  if (Object.keys(nodeEntry.componentSets).length === 0) {
    throw new FigmaInspectError(`No component sets found for node ${nodeId}.`);
  }

  const nameIndex = buildLenientNameIndex(nodeEntry.componentSets);
  const componentSetId = resolveComponentSetId(
    nodeEntry.componentSets,
    componentSet,
    nodeId,
  );

  const documentNode = findDocumentNode(
    nodeEntry.document,
    componentSetId,
    "COMPONENT_SET",
  );

  if (!documentNode) {
    throw new FigmaInspectError(
      `Component set ${componentSetId} not found in document tree for node ${nodeId}.`,
    );
  }

  return {
    tree: documentNode,
    componentSets: nodeEntry.componentSets,
    components: nodeEntry.components,
    nameIndex,
  };
}

export async function loadComponentSetContextByNodeRef({
  token,
  fileKey,
  nodeId,
  fetchImpl,
}: ComponentSetNodeRefOptions): Promise<ComponentSetContext> {
  const nodeEntry = await fetchFileNodeEntry({
    token,
    fileKey,
    nodeId,
    fetchImpl,
  });
  const componentSetNode = assertComponentSetNode(nodeEntry.document, nodeId);

  return componentSetContextFromNodeEntry(nodeEntry, componentSetNode);
}
