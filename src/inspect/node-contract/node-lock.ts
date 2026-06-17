import { readFile, writeFile } from "node:fs/promises";
import { parse } from "yaml";
import { serializeContractData } from "../contract/contract-format.js";
import { FigmaInspectError } from "../errors.js";
import type {
  NodeContractDependency,
  NodeContractFigmaType,
  NodeContractKind,
  NodeContractLock,
  NodeContractSource,
} from "./types.js";

export interface NodeContractLockDiff {
  source: boolean;
  tree: boolean;
  kind: boolean;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function normalizeKind(value: unknown): NodeContractKind | undefined {
  return value === "frame" || value === "component" ? value : undefined;
}

function normalizeNodeType(value: unknown): NodeContractFigmaType | undefined {
  return value === "FRAME" || value === "COMPONENT" ? value : undefined;
}

function normalizeSource(value: unknown): NodeContractSource | undefined {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  const fileKey = readString(record, "fileKey");
  const nodeId = readString(record, "nodeId");
  const nodeType = normalizeNodeType(record.nodeType);
  const name = readString(record, "name");
  if (!fileKey || !nodeId || !nodeType || !name) {
    return undefined;
  }

  const sourceUrl = readString(record, "sourceUrl");
  return {
    fileKey,
    nodeId,
    nodeType,
    name,
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}

function normalizeDependency(
  value: unknown,
): NodeContractDependency | undefined {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  const nodeId = readString(record, "nodeId");
  if (!nodeId) {
    return undefined;
  }

  return {
    nodeId,
    ...(readString(record, "name") ? { name: readString(record, "name") } : {}),
    ...(readString(record, "key") ? { key: readString(record, "key") } : {}),
    ...(readString(record, "fileKey")
      ? { fileKey: readString(record, "fileKey") }
      : {}),
    ...(readString(record, "componentSetId")
      ? { componentSetId: readString(record, "componentSetId") }
      : {}),
    ...(readString(record, "componentSetName")
      ? { componentSetName: readString(record, "componentSetName") }
      : {}),
    ...(readString(record, "componentSetKey")
      ? { componentSetKey: readString(record, "componentSetKey") }
      : {}),
  };
}

function normalizeDependencyList(
  value: unknown,
): NodeContractDependency[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const dependencies = value
    .map((entry) => normalizeDependency(entry))
    .filter(
      (dependency): dependency is NodeContractDependency =>
        dependency !== undefined,
    );
  return dependencies.length === value.length ? dependencies : undefined;
}

function normalizeLock(value: unknown): NodeContractLock | undefined {
  const record = readRecord(value);
  if (record?.version !== 1) {
    return undefined;
  }

  const kind = normalizeKind(record.kind);
  const source = normalizeSource(record.source);
  const fingerprints = readRecord(record.fingerprints);
  const dependencies = readRecord(record.dependencies);
  if (!kind || !source || !fingerprints || !dependencies) {
    return undefined;
  }

  const tree = readString(fingerprints, "tree");
  const contracts = readString(fingerprints, "contracts");
  const componentSets = normalizeDependencyList(dependencies.componentSets);
  const components = normalizeDependencyList(dependencies.components);
  if (!tree || !contracts || !componentSets || !components) {
    return undefined;
  }

  return {
    version: 1,
    kind,
    source,
    fingerprints: { tree, contracts },
    dependencies: { componentSets, components },
  };
}

export async function readNodeContractLock(
  lockPath: string,
): Promise<NodeContractLock | undefined> {
  let raw: string;
  try {
    raw = await readFile(lockPath, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }

  const lock = normalizeLock(parse(raw));
  if (!lock) {
    throw new FigmaInspectError(`Invalid node contract lock file: ${lockPath}`);
  }

  return lock;
}

export async function writeNodeContractLock(
  lockPath: string,
  lock: NodeContractLock,
): Promise<void> {
  await writeFile(lockPath, serializeContractData(lock, "yaml"), "utf8");
}

function sameSourceIdentity(
  left: NodeContractSource,
  right: NodeContractSource,
): boolean {
  return (
    left.fileKey === right.fileKey &&
    left.nodeId === right.nodeId &&
    left.nodeType === right.nodeType &&
    left.name === right.name
  );
}

export function diffNodeContractLock(
  locked: NodeContractLock,
  live: NodeContractLock,
): NodeContractLockDiff {
  return {
    source: !sameSourceIdentity(locked.source, live.source),
    tree: locked.fingerprints.tree !== live.fingerprints.tree,
    kind: locked.kind !== live.kind,
  };
}

export function isNodeContractLockDiffEmpty(
  diff: NodeContractLockDiff,
): boolean {
  return !diff.source && !diff.tree && !diff.kind;
}
