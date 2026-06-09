import { FigmaInspectError } from "./errors.js";
import {
  type ComponentEntry,
  type DocumentNode,
  type FigmaComponentSet,
  fetchFileNodeEntry,
} from "./schemas.js";
import type { ComponentSetLookup, ComponentSetScopeOptions } from "./types.js";

export interface ComponentSetContext {
  tree: DocumentNode;
  componentSets: Record<string, FigmaComponentSet>;
  components: Record<string, ComponentEntry>;
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
  componentSets: Record<string, FigmaComponentSet>,
  lookup: ComponentSetLookup,
  nodeId: string,
): string {
  if (lookup.kind === "key") {
    for (const [id, entry] of Object.entries(componentSets)) {
      if (entry.key === lookup.value) {
        return id;
      }
    }

    throw new FigmaInspectError(
      `No component set with key ${lookup.value} found in node ${nodeId}.`,
    );
  }

  const matches = Object.entries(componentSets).filter(
    ([, entry]) => entry.name === lookup.value,
  );

  if (matches.length === 0) {
    throw new FigmaInspectError(
      `No component set with name "${lookup.value}" found in node ${nodeId}.`,
    );
  }

  if (matches.length > 1) {
    const ids = matches.map(([id]) => id).join(", ");
    throw new FigmaInspectError(
      `Multiple component sets named "${lookup.value}" found in node ${nodeId}: ${ids}. Use --component-set-key instead.`,
    );
  }

  return matches[0][0];
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
  };
}

export async function getNodeComponentSet(
  options: ComponentSetScopeOptions,
): Promise<DocumentNode> {
  const { tree } = await loadComponentSetContext(options);
  return tree;
}
