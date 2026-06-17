import { FigmaInspectError } from "./errors.js";
import { fetchFileNodeEntry } from "./fetch-file-node-entry.js";
import { assertNodeContractRoot } from "./node-contract/node-kind.js";
import type { ExportContractTarget, FigmaNodeRef } from "./types.js";

export interface ResolveExportContractTargetOptions extends FigmaNodeRef {
  token: string;
  fetchImpl?: typeof fetch;
}

export async function resolveExportContractTarget(
  options: ResolveExportContractTargetOptions,
): Promise<ExportContractTarget> {
  const entry = await fetchFileNodeEntry({
    token: options.token,
    fileKey: options.fileKey,
    nodeId: options.nodeId,
    fetchImpl: options.fetchImpl,
  });

  const node = entry.document;
  const nodeType = node?.type;
  if (!node) {
    throw new FigmaInspectError(
      `Node ${options.nodeId} has no document payload.`,
    );
  }

  if (nodeType === "COMPONENT_SET") {
    return {
      kind: "component-set",
      fileKey: options.fileKey,
      nodeId: node.id ?? options.nodeId,
    };
  }

  if (nodeType === "FRAME" || nodeType === "COMPONENT") {
    const { node: nodeContractRoot } = assertNodeContractRoot(
      entry,
      options.nodeId,
    );
    return {
      kind: "node",
      fileKey: options.fileKey,
      nodeId: nodeContractRoot.id ?? options.nodeId,
    };
  }

  throw new FigmaInspectError(
    `Figma node ${options.nodeId} is ${nodeType ?? "UNKNOWN"}; --export-contract supports COMPONENT_SET, FRAME, or standalone COMPONENT.`,
  );
}
