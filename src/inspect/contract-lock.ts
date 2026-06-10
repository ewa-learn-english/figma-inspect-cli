import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { serializeContractData } from "./contract-format.js";
import { FigmaInspectError } from "./errors.js";

export interface ContractLockSource {
  fileKey: string;
  nodeId: string;
  componentSetKey: string;
  componentSetUpdatedAt: string;
}

export interface ContractLockVariant {
  key: string;
  nodeId: string;
  name: string;
  updatedAt: string;
}

export interface ContractLockFingerprints {
  tree: string;
  contracts: string;
  assets?: Record<string, string>;
}

export interface ContractLock {
  version: 1;
  source: ContractLockSource;
  variants: ContractLockVariant[];
  fingerprints: ContractLockFingerprints;
}

function contractLockFileName(componentName: string): string {
  return `${componentName}.contract.lock.yaml`;
}

export function resolveContractLockPath(
  directory: string,
  componentName: string,
): string {
  return path.join(directory, contractLockFileName(componentName));
}

function sortVariants(variants: ContractLockVariant[]): ContractLockVariant[] {
  return [...variants].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function buildContractLock(input: {
  source: ContractLockSource;
  variants: ContractLockVariant[];
  fingerprints: ContractLockFingerprints;
}): ContractLock {
  return {
    version: 1,
    source: input.source,
    variants: sortVariants(input.variants),
    fingerprints: {
      ...input.fingerprints,
      ...(input.fingerprints.assets
        ? {
            assets: Object.fromEntries(
              Object.entries(input.fingerprints.assets).sort(
                ([left], [right]) => left.localeCompare(right),
              ),
            ),
          }
        : {}),
    },
  };
}

export async function readContractLock(
  lockPath: string,
): Promise<ContractLock | undefined> {
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

  const parsed = parse(raw);
  const lock = normalizeContractLock(parsed);
  if (!lock) {
    throw new FigmaInspectError(`Invalid contract lock file: ${lockPath}`);
  }

  return lock;
}

function readRecordField(
  value: unknown,
  camelKey: string,
  snakeKey: string,
): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return record[camelKey] ?? record[snakeKey];
}

function readStringField(
  value: unknown,
  camelKey: string,
  snakeKey: string,
): string | undefined {
  const field = readRecordField(value, camelKey, snakeKey);
  return typeof field === "string" ? field : undefined;
}

function normalizeContractLockVariant(
  value: unknown,
): ContractLockVariant | undefined {
  const key = readStringField(value, "key", "key");
  const nodeId = readStringField(value, "nodeId", "node_id");
  const name = readStringField(value, "name", "name");
  const updatedAt = readStringField(value, "updatedAt", "updated_at");

  if (!key || !nodeId || !name || !updatedAt) {
    return undefined;
  }

  return { key, nodeId, name, updatedAt };
}

function normalizeContractLockSource(
  value: unknown,
): ContractLockSource | undefined {
  const fileKey = readStringField(value, "fileKey", "file_key");
  const nodeId = readStringField(value, "nodeId", "node_id");
  const componentSetKey = readStringField(
    value,
    "componentSetKey",
    "component_set_key",
  );
  const componentSetUpdatedAt = readStringField(
    value,
    "componentSetUpdatedAt",
    "component_set_updated_at",
  );

  if (!fileKey || !nodeId || !componentSetKey || !componentSetUpdatedAt) {
    return undefined;
  }

  return { fileKey, nodeId, componentSetKey, componentSetUpdatedAt };
}

function normalizeContractLock(value: unknown): ContractLock | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (record.version !== 1) {
    return undefined;
  }

  const source = normalizeContractLockSource(record.source);
  if (!source) {
    return undefined;
  }

  if (!Array.isArray(record.variants)) {
    return undefined;
  }

  const variants = record.variants
    .map((variant) => normalizeContractLockVariant(variant))
    .filter((variant): variant is ContractLockVariant => variant !== undefined);
  if (variants.length !== record.variants.length) {
    return undefined;
  }

  const fingerprints = record.fingerprints;
  if (typeof fingerprints !== "object" || fingerprints === null) {
    return undefined;
  }

  const fingerprintRecord = fingerprints as Record<string, unknown>;
  const tree = fingerprintRecord.tree;
  const contracts = fingerprintRecord.contracts;
  if (typeof tree !== "string" || typeof contracts !== "string") {
    return undefined;
  }

  const assets = fingerprintRecord.assets;
  let normalizedAssets: Record<string, string> | undefined;
  if (assets !== undefined) {
    if (typeof assets !== "object" || assets === null) {
      return undefined;
    }

    normalizedAssets = {};
    for (const [assetKey, hash] of Object.entries(assets)) {
      if (typeof hash !== "string") {
        return undefined;
      }

      normalizedAssets[assetKey] = hash;
    }
  }

  return {
    version: 1,
    source,
    variants,
    fingerprints: {
      tree,
      contracts,
      ...(normalizedAssets ? { assets: normalizedAssets } : {}),
    },
  };
}

export async function writeContractLock(
  lockPath: string,
  lock: ContractLock,
): Promise<void> {
  await writeFile(lockPath, serializeContractData(lock, "yaml"), "utf8");
}

export function collectUnchangedVariantNodeIds(
  previousLock: ContractLock | undefined,
  variants: ContractLockVariant[],
): Set<string> {
  const unchanged = new Set<string>();
  if (!previousLock) {
    return unchanged;
  }

  const previousByNodeId = new Map(
    previousLock.variants.map((variant) => [variant.nodeId, variant]),
  );

  for (const variant of variants) {
    const previous = previousByNodeId.get(variant.nodeId);
    if (previous && previous.updatedAt === variant.updatedAt) {
      unchanged.add(variant.nodeId);
    }
  }

  return unchanged;
}
