import type { ContractFormat } from "../contract/contract-format.js";
import type {
  LockFingerprintsV1,
  LockFingerprintsV2,
} from "../contract/lock-metadata.js";
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

interface NodeContractLockBase {
  kind: NodeContractKind;
  source: NodeContractSource;
  dependencies: NodeContractDependencies;
}

interface NodeContractLockV1 extends NodeContractLockBase {
  version: 1;
  fingerprints: LockFingerprintsV1;
}

interface NodeContractLockV2 extends NodeContractLockBase {
  version: 2;
  fingerprints: LockFingerprintsV2;
}

export type NodeContractLock = NodeContractLockV1 | NodeContractLockV2;

export interface NodeContractLockDiff {
  source: boolean;
  tree: boolean;
  contractSurface: boolean;
  kind: boolean;
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
