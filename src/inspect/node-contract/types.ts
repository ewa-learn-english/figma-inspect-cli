import type { ContractFormat } from "../contract/contract-format.js";
import type { DocumentNode } from "../schemas.js";

export type NodeContractKind = "component" | "frame";
export type NodeContractFigmaType = "COMPONENT" | "FRAME";

export interface NodeContractSource {
  fileKey: string;
  nodeId: string;
  nodeType: NodeContractFigmaType;
  name: string;
  sourceUrl?: string;
}

export interface NodeContractDependency {
  nodeId: string;
  name?: string;
  key?: string;
  fileKey?: string;
  componentSetId?: string;
  componentSetName?: string;
  componentSetKey?: string;
}

export interface NodeContractDependencies {
  componentSets: NodeContractDependency[];
  components: NodeContractDependency[];
}

export interface NodeContractMeta {
  version: 1;
  kind: NodeContractKind;
  node: {
    id: string;
    name: string;
    type: NodeContractFigmaType;
  };
  componentProperties?: Record<
    string,
    {
      type?: string;
      default?: boolean | string;
      options?: string[];
    }
  >;
  dependencies: NodeContractDependencies;
}

export interface NodeContractResult {
  nodeName: string;
  kind: NodeContractKind;
  source: NodeContractSource;
  rawNode: DocumentNode;
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
  meta: NodeContractMeta;
  structureDsl: string;
  lock: NodeContractLock;
}

interface NodeContractFingerprints {
  tree: string;
  contracts: string;
}

export interface NodeContractLock {
  version: 1;
  kind: NodeContractKind;
  source: NodeContractSource;
  fingerprints: NodeContractFingerprints;
  dependencies: NodeContractDependencies;
}

export interface BuildNodeContractOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  sourceUrl?: string;
  variablesPath: string;
  format?: ContractFormat;
  fetchImpl?: typeof fetch;
}
