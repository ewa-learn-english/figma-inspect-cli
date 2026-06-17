import path from "node:path";
import type { ContractFormat } from "../contract/contract-format.js";
import type { NodeContractKind } from "./types.js";

export type NodeContractArtifact = "geometry" | "meta" | "visuals";

function dataFileExtension(format: ContractFormat): string {
  return format === "yaml" ? ".yaml" : ".json";
}

export function nodeContractArtifactFileName(
  nodeName: string,
  kind: NodeContractKind,
  artifact: NodeContractArtifact,
  format: ContractFormat = "yaml",
): string {
  return `${nodeName}.${kind}.${artifact}${dataFileExtension(format)}`;
}

function nodeContractStructureFileName(
  nodeName: string,
  kind: NodeContractKind,
): string {
  return `${nodeName}.${kind}.structure.dsl`;
}

function nodeContractLockFileName(
  nodeName: string,
  kind: NodeContractKind,
): string {
  return `${nodeName}.${kind}.lock.yaml`;
}

export function resolveNodeMetaContractPath(
  directory: string,
  nodeName: string,
  kind: NodeContractKind,
  format: ContractFormat = "yaml",
): string {
  return path.join(
    directory,
    nodeContractArtifactFileName(nodeName, kind, "meta", format),
  );
}

export function resolveNodeGeometryContractPath(
  directory: string,
  nodeName: string,
  kind: NodeContractKind,
  format: ContractFormat = "yaml",
): string {
  return path.join(
    directory,
    nodeContractArtifactFileName(nodeName, kind, "geometry", format),
  );
}

export function resolveNodeVisualsContractPath(
  directory: string,
  nodeName: string,
  kind: NodeContractKind,
  format: ContractFormat = "yaml",
): string {
  return path.join(
    directory,
    nodeContractArtifactFileName(nodeName, kind, "visuals", format),
  );
}

export function resolveNodeStructureDslPath(
  directory: string,
  nodeName: string,
  kind: NodeContractKind,
): string {
  return path.join(directory, nodeContractStructureFileName(nodeName, kind));
}

export function resolveNodeContractLockPath(
  directory: string,
  nodeName: string,
  kind: NodeContractKind,
): string {
  return path.join(directory, nodeContractLockFileName(nodeName, kind));
}
