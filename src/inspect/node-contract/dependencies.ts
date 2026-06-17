import {
  isRecord,
  readChildren,
  readRecord,
  readString,
} from "../component-set-spec/figma-node.js";
import type { DocumentNode, FileNodeEntry } from "../schemas.js";
import type {
  NodeContractDependencies,
  NodeContractDependency,
  NodeContractMeta,
} from "./types.js";

function sortDependencyEntries(
  entries: NodeContractDependency[],
): NodeContractDependency[] {
  return [...entries].sort((left, right) => {
    const leftLabel = left.name ?? left.nodeId;
    const rightLabel = right.name ?? right.nodeId;
    const byLabel = leftLabel.localeCompare(rightLabel);
    return byLabel === 0 ? left.nodeId.localeCompare(right.nodeId) : byLabel;
  });
}

function compactDependency(
  dependency: NodeContractDependency,
): NodeContractDependency {
  return Object.fromEntries(
    Object.entries(dependency).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as NodeContractDependency;
}

function walkNode(
  node: DocumentNode,
  visit: (node: DocumentNode) => void,
): void {
  visit(node);
  for (const child of readChildren(node)) {
    walkNode(child as DocumentNode, visit);
  }
}

export function collectNodeContractDependencies(
  entry: FileNodeEntry,
  root: DocumentNode,
  fileKey: string,
): NodeContractDependencies {
  const componentsByNodeId = new Map<string, NodeContractDependency>();
  const componentSetsByNodeId = new Map<string, NodeContractDependency>();

  walkNode(root, (node) => {
    if (node.type !== "INSTANCE") {
      return;
    }

    const componentId = readString(node, "componentId");
    if (!componentId) {
      return;
    }

    const componentEntry = entry.components[componentId];
    const componentSetId = componentEntry?.componentSetId;
    const componentSetEntry = componentSetId
      ? entry.componentSets[componentSetId]
      : undefined;

    componentsByNodeId.set(
      componentId,
      compactDependency({
        nodeId: componentId,
        key: componentEntry?.key,
        name: componentEntry?.name ?? readString(node, "name"),
        fileKey,
        componentSetId,
        componentSetName: componentSetEntry?.name,
        componentSetKey: componentSetEntry?.key,
      }),
    );

    if (componentSetId && componentSetEntry) {
      componentSetsByNodeId.set(
        componentSetId,
        compactDependency({
          nodeId: componentSetId,
          key: componentSetEntry.key,
          name: componentSetEntry.name,
          fileKey,
        }),
      );
    }
  });

  return {
    componentSets: sortDependencyEntries([...componentSetsByNodeId.values()]),
    components: sortDependencyEntries([...componentsByNodeId.values()]),
  };
}

export function readComponentPropertyDefinitions(
  node: DocumentNode,
): NonNullable<NodeContractMeta["componentProperties"]> | undefined {
  const definitions = readRecord(node, "componentPropertyDefinitions");
  if (!definitions) {
    return undefined;
  }

  const properties: NonNullable<NodeContractMeta["componentProperties"]> = {};
  for (const [rawName, rawDefinition] of Object.entries(definitions)) {
    if (!isRecord(rawDefinition)) {
      continue;
    }

    const type = readString(rawDefinition, "type");
    const defaultValue = rawDefinition.defaultValue;
    const variantOptions = rawDefinition.variantOptions;
    const options = Array.isArray(variantOptions)
      ? variantOptions.filter(
          (value): value is string => typeof value === "string",
        )
      : undefined;

    properties[rawName] = {
      ...(type ? { type } : {}),
      ...(typeof defaultValue === "string" || typeof defaultValue === "boolean"
        ? { default: defaultValue }
        : {}),
      ...(options && options.length > 0 ? { options } : {}),
    };
  }

  return Object.keys(properties).length > 0 ? properties : undefined;
}
