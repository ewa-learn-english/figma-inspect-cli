import { FigmaInspectError } from "../errors.js";
import type { DocumentNode, FileNodeEntry } from "../schemas.js";
import type { NodeContractFigmaType, NodeContractKind } from "./types.js";

function nodeContractKindFromType(
  nodeType: string | undefined,
): NodeContractKind | undefined {
  if (nodeType === "FRAME") {
    return "frame";
  }
  if (nodeType === "COMPONENT") {
    return "component";
  }
  return undefined;
}

export function assertNodeContractRoot(
  entry: FileNodeEntry,
  nodeId: string,
): {
  node: DocumentNode & { type: NodeContractFigmaType };
  kind: NodeContractKind;
} {
  const node = entry.document;
  if (!node) {
    throw new FigmaInspectError(`Node ${nodeId} has no document payload.`);
  }

  const kind = nodeContractKindFromType(node.type);
  if (!kind) {
    throw new FigmaInspectError(
      `Figma node ${nodeId} is ${node.type ?? "UNKNOWN"}; expected FRAME or standalone COMPONENT.`,
    );
  }

  if (kind === "component") {
    const componentEntry =
      entry.components[node.id ?? nodeId] ?? entry.components[nodeId];
    if (componentEntry?.componentSetId) {
      throw new FigmaInspectError(
        `Figma node ${nodeId} is a COMPONENT inside a component set; use --export-component-set for component sets.`,
      );
    }
  }

  return {
    node: node as DocumentNode & { type: NodeContractFigmaType },
    kind,
  };
}
