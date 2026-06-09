import { getFileNode } from "../figma-api/get-file-node.js";
import type { GetFileNodeOptions } from "../figma-api/types.js";
import { FigmaInspectError } from "./errors.js";

export interface ComponentSetEntry {
  key?: string;
  name?: string;
}

export interface ComponentEntry {
  key?: string;
  name?: string;
  componentSetId?: string;
}

export interface DocumentNode {
  id?: string;
  name?: string;
  type?: string;
  componentId?: string;
  isExposedInstance?: boolean;
  children?: DocumentNode[];
}

export interface FileNodeEntry {
  document?: DocumentNode;
  componentSets: Record<string, ComponentSetEntry>;
  components: Record<string, ComponentEntry>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseComponentSetEntry(value: unknown): ComponentSetEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    key: typeof value.key === "string" ? value.key : undefined,
    name: typeof value.name === "string" ? value.name : undefined,
  };
}

function parseComponentEntry(value: unknown): ComponentEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    key: typeof value.key === "string" ? value.key : undefined,
    name: typeof value.name === "string" ? value.name : undefined,
    componentSetId:
      typeof value.componentSetId === "string"
        ? value.componentSetId
        : undefined,
  };
}

function parseRecord<T>(
  value: unknown,
  parseEntry: (entry: unknown) => T | undefined,
): Record<string, T> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, T> = {};
  for (const [id, entry] of Object.entries(value)) {
    const parsed = parseEntry(entry);
    if (parsed) {
      result[id] = parsed;
    }
  }

  return result;
}

function parseDocumentNode(value: unknown): DocumentNode | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const children = Array.isArray(value.children)
    ? value.children
        .map(parseDocumentNode)
        .filter((child): child is DocumentNode => child !== undefined)
    : undefined;

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    name: typeof value.name === "string" ? value.name : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    componentId:
      typeof value.componentId === "string" ? value.componentId : undefined,
    isExposedInstance: value.isExposedInstance === true,
    children,
  };
}

function parseFileNodeEntry(payload: unknown, nodeId: string): FileNodeEntry {
  if (!isRecord(payload)) {
    throw new FigmaInspectError("Invalid Figma file nodes response.");
  }

  const nodes = payload.nodes;
  if (!isRecord(nodes) || !isRecord(nodes[nodeId])) {
    throw new FigmaInspectError(`Node ${nodeId} not found in Figma response.`);
  }

  const nodeEntry = nodes[nodeId];

  return {
    document: parseDocumentNode(nodeEntry.document),
    componentSets: parseRecord(nodeEntry.componentSets, parseComponentSetEntry),
    components: parseRecord(nodeEntry.components, parseComponentEntry),
  };
}

export async function fetchFileNodeEntry(
  options: GetFileNodeOptions,
): Promise<FileNodeEntry> {
  const payload = await getFileNode(options);
  return parseFileNodeEntry(payload, options.nodeId);
}
