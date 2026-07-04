import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ContractFormat } from "../contract/contract-format.js";
import {
  fingerprintContractSurface,
  fingerprintTree,
} from "../contract/fingerprint.js";
import { FigmaInspectError } from "../errors.js";
import { fetchFileNodeEntry } from "../fetch-file-node-entry.js";
import { collectNodeContractDependencies } from "./dependencies.js";
import { assertNodeContractRoot } from "./node-kind.js";
import {
  diffNodeContractLock,
  isNodeContractLockDiffEmpty,
  readNodeContractLock,
} from "./node-lock.js";
import {
  detectNodeContractFormat,
  readNodeContractArtifacts,
  validateNodeContractArtifacts,
} from "./node-schema.js";
import type {
  NodeContractKind,
  NodeContractLock,
  NodeContractLockDiff,
} from "./types.js";

type NodeContractVerifyStatus = "changed" | "error" | "ok";

export interface NodeContractVerifyResult {
  nodeName: string;
  kind: NodeContractKind;
  status: NodeContractVerifyStatus;
  errors: string[];
  changed: NodeContractLockDiff;
}

export interface VerifyNodeContractsOptions {
  token: string;
  contractDir: string;
  nodeName?: string;
  contractFormat?: ContractFormat;
  fetchImpl?: typeof fetch;
}

interface DiscoveredNodeLock {
  nodeName: string;
  kind: NodeContractKind;
  lockPath: string;
}

function emptyDiff(): NodeContractLockDiff {
  return {
    source: false,
    tree: false,
    contractSurface: false,
    kind: false,
  };
}

function lockFileNamePattern(): RegExp {
  return /^(.+)\.(frame|component)\.lock\.yaml$/;
}

async function discoverNodeLocks(
  contractDir: string,
  nodeName?: string,
): Promise<DiscoveredNodeLock[]> {
  const entries = await readdir(contractDir, { withFileTypes: true });
  const locks: DiscoveredNodeLock[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = entry.name.match(lockFileNamePattern());
    const matchedNodeName = match?.[1];
    const matchedKind = match?.[2] as NodeContractKind | undefined;
    if (!matchedNodeName || !matchedKind) {
      continue;
    }
    if (nodeName && matchedNodeName !== nodeName) {
      continue;
    }
    locks.push({
      nodeName: matchedNodeName,
      kind: matchedKind,
      lockPath: path.join(contractDir, entry.name),
    });
  }

  return locks.sort((left, right) => {
    const byName = left.nodeName.localeCompare(right.nodeName);
    return byName === 0 ? left.kind.localeCompare(right.kind) : byName;
  });
}

async function verifySingleNodeContract(
  options: VerifyNodeContractsOptions,
  discovered: DiscoveredNodeLock,
): Promise<NodeContractVerifyResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const lock = await readNodeContractLock(discovered.lockPath);
    if (!lock) {
      return {
        nodeName: discovered.nodeName,
        kind: discovered.kind,
        status: "error",
        errors: [`Missing lock file: ${discovered.lockPath}`],
        changed: emptyDiff(),
      };
    }

    const contractFormat =
      options.contractFormat ??
      (await detectNodeContractFormat(
        options.contractDir,
        discovered.nodeName,
        discovered.kind,
      ));
    const artifacts = await readNodeContractArtifacts(
      options.contractDir,
      discovered.nodeName,
      discovered.kind,
      contractFormat,
    );
    validateNodeContractArtifacts(artifacts, contractFormat);

    const entry = await fetchFileNodeEntry({
      token: options.token,
      fileKey: lock.source.fileKey,
      nodeId: lock.source.nodeId,
      fetchImpl,
    });
    const { node, kind } = assertNodeContractRoot(entry, lock.source.nodeId);
    const live: NodeContractLock = {
      version: 2,
      kind,
      source: {
        fileKey: lock.source.fileKey,
        nodeId: node.id ?? lock.source.nodeId,
        nodeType: node.type,
        name:
          typeof node.name === "string" && node.name.length > 0
            ? node.name
            : lock.source.nodeId,
        ...(lock.source.sourceUrl ? { sourceUrl: lock.source.sourceUrl } : {}),
      },
      fingerprints: {
        tree: fingerprintTree(node),
        contractSurface: fingerprintContractSurface(node),
        contracts: lock.fingerprints.contracts,
      },
      dependencies: collectNodeContractDependencies(
        entry,
        node,
        lock.source.fileKey,
      ),
    };
    const changed = diffNodeContractLock(lock, live);
    const status = isNodeContractLockDiffEmpty(changed) ? "ok" : "changed";

    return {
      nodeName: discovered.nodeName,
      kind: discovered.kind,
      status,
      errors: [],
      changed,
    };
  } catch (error) {
    const message =
      error instanceof FigmaInspectError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      nodeName: discovered.nodeName,
      kind: discovered.kind,
      status: "error",
      errors: [message],
      changed: emptyDiff(),
    };
  }
}

export async function verifyNodeContracts(
  options: VerifyNodeContractsOptions,
): Promise<NodeContractVerifyResult[]> {
  const discoveredLocks = await discoverNodeLocks(
    options.contractDir,
    options.nodeName,
  );
  if (discoveredLocks.length === 0) {
    throw new FigmaInspectError(
      options.nodeName
        ? `No node lock files found for ${options.nodeName} in ${options.contractDir}.`
        : `No *.frame.lock.yaml or *.component.lock.yaml files found in ${options.contractDir}.`,
    );
  }

  const results: NodeContractVerifyResult[] = [];
  for (const lock of discoveredLocks) {
    results.push(await verifySingleNodeContract(options, lock));
  }

  return results;
}
