import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { serializeContractData } from "./contract-format.js";
import { FigmaInspectError } from "./errors.js";

export interface ContractLockSource {
  file_key: string;
  node_id: string;
  component_set_key: string;
  component_set_updated_at: string;
}

export interface ContractLockVariant {
  key: string;
  node_id: string;
  name: string;
  updated_at: string;
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
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as ContractLock).version !== 1
  ) {
    throw new FigmaInspectError(`Invalid contract lock file: ${lockPath}`);
  }

  return parsed as ContractLock;
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
    previousLock.variants.map((variant) => [variant.node_id, variant]),
  );

  for (const variant of variants) {
    const previous = previousByNodeId.get(variant.node_id);
    if (previous && previous.updated_at === variant.updated_at) {
      unchanged.add(variant.node_id);
    }
  }

  return unchanged;
}
