import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { FigmaInspectError } from "../errors.js";
import { serializeContractData } from "./contract-format.js";
import {
  defaultLockApproval,
  defaultLockDrift,
  hasContractSurfaceFingerprint,
  type LockApproval,
  type LockDrift,
  type LockFingerprintsV1,
  type LockFingerprintsV2,
  normalizeLockVersion,
  normalizeVersionedLockMetadata,
} from "./lock-metadata.js";

export interface ContractLockSource {
  fileKey: string;
  nodeId: string;
  nodeType?: "COMPONENT_SET";
  sourceUrl?: string;
  componentSetKey: string;
  componentSetUpdatedAt: string;
}

export interface ContractLockVariant {
  key: string;
  nodeId: string;
  name: string;
  updatedAt: string;
}

interface ContractLockFingerprintsV1 extends LockFingerprintsV1 {
  assets?: Record<string, string>;
}

export interface ContractLockFingerprintsV2 extends LockFingerprintsV2 {
  assets?: Record<string, string>;
}

type ContractLockFingerprints =
  | ContractLockFingerprintsV1
  | ContractLockFingerprintsV2;

interface ContractLockBase {
  kind: "component-set";
  source: ContractLockSource;
  variants: ContractLockVariant[];
  fingerprints: ContractLockFingerprints;
  approval: LockApproval;
  drift: LockDrift;
}

interface ContractLockV1 extends ContractLockBase {
  version: 1;
  fingerprints: ContractLockFingerprintsV1;
}

interface ContractLockV2 extends ContractLockBase {
  version: 2;
  source: ContractLockSource & { nodeType: "COMPONENT_SET" };
  fingerprints: ContractLockFingerprintsV2;
}

export type ContractLock = ContractLockV1 | ContractLockV2;

function contractLockFileName(componentName: string): string {
  return `${componentName}.component-set.lock.yaml`;
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

function sameSourceIdentity(
  left: ContractLockSource,
  right: ContractLockSource,
): boolean {
  return (
    left.fileKey === right.fileKey &&
    left.nodeId === right.nodeId &&
    (left.nodeType ?? "COMPONENT_SET") ===
      (right.nodeType ?? "COMPONENT_SET") &&
    left.componentSetKey === right.componentSetKey
  );
}

function sameVariantIdentity(
  left: ContractLockVariant,
  right: ContractLockVariant,
): boolean {
  return (
    left.key === right.key &&
    left.nodeId === right.nodeId &&
    left.name === right.name
  );
}

export function buildContractLock(input: {
  source: ContractLockSource;
  variants: ContractLockVariant[];
  fingerprints: ContractLockFingerprintsV2;
}): ContractLockV2 {
  return {
    version: 2,
    kind: "component-set",
    source: { ...input.source, nodeType: "COMPONENT_SET" },
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
    approval: defaultLockApproval(),
    drift: defaultLockDrift(),
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
  const nodeType = readStringField(value, "nodeType", "node_type");
  const sourceUrl = readStringField(value, "sourceUrl", "source_url");
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

  return {
    fileKey,
    nodeId,
    ...(nodeType === "COMPONENT_SET" ? { nodeType } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    componentSetKey,
    componentSetUpdatedAt,
  };
}

function normalizeContractLock(value: unknown): ContractLock | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const version = normalizeLockVersion(record);
  if (!version) {
    return undefined;
  }
  if (
    version === 2 &&
    (record.kind !== "component-set" ||
      normalizeContractLockSource(record.source)?.nodeType !== "COMPONENT_SET")
  ) {
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
  const contractSurface = fingerprintRecord.contractSurface;
  const contracts = fingerprintRecord.contracts;
  if (typeof tree !== "string" || typeof contracts !== "string") {
    return undefined;
  }
  if (version === 2 && typeof contractSurface !== "string") {
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

  const metadata = normalizeVersionedLockMetadata(record, version);
  if (!metadata) {
    return undefined;
  }

  const base = {
    kind: "component-set" as const,
    variants,
    approval: metadata.approval,
    drift: metadata.drift,
  };

  if (version === 2) {
    if (typeof contractSurface !== "string") {
      return undefined;
    }

    return {
      ...base,
      version,
      source: { ...source, nodeType: "COMPONENT_SET" },
      fingerprints: {
        tree,
        contractSurface,
        contracts,
        ...(normalizedAssets ? { assets: normalizedAssets } : {}),
      },
    };
  }

  return {
    ...base,
    version,
    source,
    fingerprints: {
      tree,
      contracts,
      ...(normalizedAssets ? { assets: normalizedAssets } : {}),
    },
  };
}

export function toLockVariants(
  components: ReadonlyArray<{
    key: string;
    node_id: string;
    name: string;
    updated_at: string;
  }>,
): ContractLockVariant[] {
  return components.map((component) => ({
    key: component.key,
    nodeId: component.node_id,
    name: component.name,
    updatedAt: component.updated_at,
  }));
}

export interface ContractLockDiff {
  source: boolean;
  tree: boolean;
  contractSurface: boolean;
  variants: string[];
  addedVariants: string[];
  removedVariants: string[];
}

function sameContractSurface(
  lock: ContractLock,
  live: { treeFingerprint: string; contractSurfaceFingerprint?: string },
): boolean {
  if (
    hasContractSurfaceFingerprint(lock.fingerprints) &&
    live.contractSurfaceFingerprint
  ) {
    return (
      lock.fingerprints.contractSurface === live.contractSurfaceFingerprint
    );
  }

  return lock.fingerprints.tree === live.treeFingerprint;
}

export function diffContractLock(
  lock: ContractLock,
  live: {
    source: ContractLockSource;
    variants: ContractLockVariant[];
    treeFingerprint: string;
    contractSurfaceFingerprint?: string;
  },
): ContractLockDiff {
  const lockedByNodeId = new Map(
    lock.variants.map((variant) => [variant.nodeId, variant]),
  );
  const liveByNodeId = new Map(
    live.variants.map((variant) => [variant.nodeId, variant]),
  );

  const changedVariants: string[] = [];
  const addedVariants: string[] = [];
  const removedVariants: string[] = [];

  for (const liveVariant of live.variants) {
    const locked = lockedByNodeId.get(liveVariant.nodeId);
    if (!locked) {
      addedVariants.push(liveVariant.name);
      continue;
    }

    if (!sameVariantIdentity(locked, liveVariant)) {
      changedVariants.push(liveVariant.name);
    }
  }

  for (const lockedVariant of lock.variants) {
    if (!liveByNodeId.has(lockedVariant.nodeId)) {
      removedVariants.push(lockedVariant.name);
    }
  }

  return {
    source: !sameSourceIdentity(lock.source, live.source),
    tree:
      !hasContractSurfaceFingerprint(lock.fingerprints) &&
      lock.fingerprints.tree !== live.treeFingerprint,
    contractSurface: !sameContractSurface(lock, live),
    variants: changedVariants.sort((left, right) => left.localeCompare(right)),
    addedVariants: addedVariants.sort((left, right) =>
      left.localeCompare(right),
    ),
    removedVariants: removedVariants.sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

export function isContractLockDiffEmpty(diff: ContractLockDiff): boolean {
  return (
    !diff.source &&
    !diff.tree &&
    !diff.contractSurface &&
    diff.variants.length === 0 &&
    diff.addedVariants.length === 0 &&
    diff.removedVariants.length === 0
  );
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
  currentTreeFingerprint?: string,
  currentContractSurfaceFingerprint?: string,
): Set<string> {
  const unchanged = new Set<string>();
  if (!previousLock) {
    return unchanged;
  }

  const previousByNodeId = new Map(
    previousLock.variants.map((variant) => [variant.nodeId, variant]),
  );
  const treeIsUnchanged =
    currentTreeFingerprint !== undefined &&
    previousLock.fingerprints.tree === currentTreeFingerprint;
  const contractSurfaceIsUnchanged =
    currentContractSurfaceFingerprint !== undefined &&
    hasContractSurfaceFingerprint(previousLock.fingerprints) &&
    previousLock.fingerprints.contractSurface ===
      currentContractSurfaceFingerprint;
  const sourceSurfaceIsUnchanged = hasContractSurfaceFingerprint(
    previousLock.fingerprints,
  )
    ? contractSurfaceIsUnchanged
    : treeIsUnchanged;

  for (const variant of variants) {
    const previous = previousByNodeId.get(variant.nodeId);
    if (!previous) {
      continue;
    }

    if (sourceSurfaceIsUnchanged && sameVariantIdentity(previous, variant)) {
      unchanged.add(variant.nodeId);
      continue;
    }

    if (previous.updatedAt === variant.updatedAt) {
      unchanged.add(variant.nodeId);
    }
  }

  return unchanged;
}

export function stabilizeContractLockDates(
  previousLock: ContractLock | undefined,
  lock: ContractLock,
): ContractLock {
  const sourceSurfaceIsUnchanged =
    previousLock &&
    hasContractSurfaceFingerprint(previousLock.fingerprints) &&
    hasContractSurfaceFingerprint(lock.fingerprints)
      ? previousLock.fingerprints.contractSurface ===
        lock.fingerprints.contractSurface
      : previousLock?.fingerprints.tree === lock.fingerprints.tree;

  if (!previousLock || !sourceSurfaceIsUnchanged) {
    return lock;
  }

  const previousByNodeId = new Map(
    previousLock.variants.map((variant) => [variant.nodeId, variant]),
  );
  const source = sameSourceIdentity(previousLock.source, lock.source)
    ? {
        ...lock.source,
        componentSetUpdatedAt: previousLock.source.componentSetUpdatedAt,
      }
    : lock.source;
  const variants = lock.variants.map((variant) => {
    const previous = previousByNodeId.get(variant.nodeId);
    if (!previous || !sameVariantIdentity(previous, variant)) {
      return variant;
    }

    return {
      ...variant,
      updatedAt: previous.updatedAt,
    };
  });

  if (lock.version === 2) {
    return {
      ...lock,
      source: { ...source, nodeType: "COMPONENT_SET" },
      variants,
    };
  }

  return {
    ...lock,
    source,
    variants,
  };
}
