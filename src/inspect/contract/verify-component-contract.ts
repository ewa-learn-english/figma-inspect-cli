import { readdir } from "node:fs/promises";
import {
  filterFileComponentsForComponentSet,
  getComponentSetByKey,
  listFileComponents,
} from "../../figma-api/index.js";
import { loadComponentSetContext } from "../component-set-context.js";
import { FigmaInspectError } from "../errors.js";
import {
  type ContractFormat,
  detectContractFormat,
} from "./contract-format.js";
import {
  type ContractLock,
  type ContractLockDiff,
  type ContractLockSource,
  type ContractLockVariant,
  diffContractLock,
  isContractLockDiffEmpty,
  readContractLock,
  resolveContractLockPath,
  toLockVariants,
} from "./contract-lock.js";
import {
  readComponentContractArtifacts,
  validateComponentContractArtifacts,
} from "./contract-schema.js";
import { fingerprintContractSurface, fingerprintTree } from "./fingerprint.js";

type ComponentContractVerifyStatus = "ok" | "changed" | "error";

export interface ComponentContractVerifyResult {
  componentName: string;
  status: ComponentContractVerifyStatus;
  errors: string[];
  changed: ContractLockDiff;
}

export interface VerifyComponentContractsOptions {
  token: string;
  contractDir: string;
  componentName?: string;
  contractFormat?: ContractFormat;
  fetchImpl?: typeof fetch;
}

interface LiveLockSnapshot {
  source: ContractLockSource;
  variants: ContractLockVariant[];
  treeFingerprint: string;
  contractSurfaceFingerprint: string;
}

function lockFileNamePattern(): RegExp {
  return /^(.+)\.component-set\.lock\.yaml$/;
}

async function discoverLockedComponentNames(
  contractDir: string,
): Promise<string[]> {
  const entries = await readdir(contractDir, { withFileTypes: true });
  const names: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = entry.name.match(lockFileNamePattern());
    if (match?.[1]) {
      names.push(match[1]);
    }
  }

  return names.sort((left, right) => left.localeCompare(right));
}

async function fetchLiveLockSnapshot(
  token: string,
  lock: ContractLock,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveLockSnapshot> {
  const [componentSetMeta, fileComponents, context] = await Promise.all([
    getComponentSetByKey({
      token,
      componentSetKey: lock.source.componentSetKey,
      fetchImpl,
    }),
    listFileComponents({
      token,
      fileKey: lock.source.fileKey,
      fetchImpl,
    }),
    loadComponentSetContext({
      token,
      fileKey: lock.source.fileKey,
      nodeId: lock.source.nodeId,
      componentSet: { kind: "key", value: lock.source.componentSetKey },
      fetchImpl,
    }),
  ]);

  return {
    source: {
      fileKey: componentSetMeta.file_key,
      nodeId: componentSetMeta.node_id,
      nodeType: "COMPONENT_SET",
      ...(lock.source.sourceUrl ? { sourceUrl: lock.source.sourceUrl } : {}),
      componentSetKey: componentSetMeta.key,
    },
    variants: toLockVariants(
      filterFileComponentsForComponentSet(fileComponents, lock.source.nodeId),
    ),
    treeFingerprint: fingerprintTree(context.tree),
    contractSurfaceFingerprint: fingerprintContractSurface(context.tree),
  };
}

async function verifySingleComponentContract(
  options: VerifyComponentContractsOptions,
  componentName: string,
): Promise<ComponentContractVerifyResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const errors: string[] = [];
  const emptyDiff: ContractLockDiff = {
    source: false,
    tree: false,
    contractSurface: false,
    variants: [],
    addedVariants: [],
    removedVariants: [],
  };

  try {
    const lockPath = resolveContractLockPath(
      options.contractDir,
      componentName,
    );
    const lock = await readContractLock(lockPath);
    if (!lock) {
      return {
        componentName,
        status: "error",
        errors: [`Missing lock file: ${lockPath}`],
        changed: emptyDiff,
      };
    }

    const contractFormat =
      options.contractFormat ??
      (await detectContractFormat(options.contractDir, componentName));

    const artifacts = await readComponentContractArtifacts(
      options.contractDir,
      componentName,
      contractFormat,
    );
    validateComponentContractArtifacts(artifacts, contractFormat);

    const live = await fetchLiveLockSnapshot(options.token, lock, fetchImpl);
    const changed = diffContractLock(lock, live);
    const status = isContractLockDiffEmpty(changed)
      ? ("ok" as const)
      : ("changed" as const);

    return {
      componentName,
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
    errors.push(message);
    return {
      componentName,
      status: "error",
      errors,
      changed: emptyDiff,
    };
  }
}

export async function verifyComponentContracts(
  options: VerifyComponentContractsOptions,
): Promise<ComponentContractVerifyResult[]> {
  const componentNames = options.componentName
    ? [options.componentName]
    : await discoverLockedComponentNames(options.contractDir);

  if (componentNames.length === 0) {
    throw new FigmaInspectError(
      `No *.component-set.lock.yaml files found in ${options.contractDir}.`,
    );
  }

  const results: ComponentContractVerifyResult[] = [];
  for (const componentName of componentNames) {
    results.push(await verifySingleComponentContract(options, componentName));
  }

  return results;
}
