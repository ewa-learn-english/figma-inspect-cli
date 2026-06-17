export interface LockApproval {
  status: "unverified" | "verified" | "deprecated";
  verifiedAt: string | null;
  verifiedBy: string | null;
  baselineRevision: string | null;
}

export interface LockDrift {
  lastCheckedAt: string | null;
  metadataChanged: boolean;
  sourceChanged: boolean;
  structureChanged: boolean;
  visualsChanged: boolean;
}

export interface LockFingerprintsV1 {
  tree: string;
  contracts: string;
}

export interface LockFingerprintsV2 extends LockFingerprintsV1 {
  contractSurface: string;
}

export type LockFingerprints = LockFingerprintsV1 | LockFingerprintsV2;

export function hasContractSurfaceFingerprint(
  fingerprints: LockFingerprints,
): fingerprints is LockFingerprintsV2 {
  return "contractSurface" in fingerprints;
}

export function defaultLockApproval(): LockApproval {
  return {
    status: "unverified",
    verifiedAt: null,
    verifiedBy: null,
    baselineRevision: null,
  };
}

export function defaultLockDrift(): LockDrift {
  return {
    lastCheckedAt: null,
    metadataChanged: false,
    sourceChanged: false,
    structureChanged: false,
    visualsChanged: false,
  };
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const field = record[key];
  if (field === null) {
    return null;
  }
  return typeof field === "string" ? field : undefined;
}

export function normalizeLockVersion(value: unknown): 1 | 2 | undefined {
  const record = readRecord(value);
  return record?.version === 1 || record?.version === 2
    ? record.version
    : undefined;
}

function normalizeLockApproval(value: unknown): LockApproval | undefined {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  const status = record.status;
  if (
    status !== "unverified" &&
    status !== "verified" &&
    status !== "deprecated"
  ) {
    return undefined;
  }

  const verifiedAt = readNullableString(record, "verifiedAt");
  const verifiedBy = readNullableString(record, "verifiedBy");
  const baselineRevision = readNullableString(record, "baselineRevision");
  if (
    verifiedAt === undefined ||
    verifiedBy === undefined ||
    baselineRevision === undefined
  ) {
    return undefined;
  }

  return { status, verifiedAt, verifiedBy, baselineRevision };
}

function normalizeLockDrift(value: unknown): LockDrift | undefined {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  const lastCheckedAt = record.lastCheckedAt;
  const metadataChanged = record.metadataChanged;
  const sourceChanged = record.sourceChanged;
  const structureChanged = record.structureChanged;
  const visualsChanged = record.visualsChanged;
  if (lastCheckedAt !== null && typeof lastCheckedAt !== "string") {
    return undefined;
  }
  if (
    typeof metadataChanged !== "boolean" ||
    typeof sourceChanged !== "boolean" ||
    typeof structureChanged !== "boolean" ||
    typeof visualsChanged !== "boolean"
  ) {
    return undefined;
  }

  return {
    lastCheckedAt,
    metadataChanged,
    sourceChanged,
    structureChanged,
    visualsChanged,
  };
}

export function normalizeVersionedLockMetadata(
  record: Record<string, unknown>,
  version: 1 | 2,
): { approval: LockApproval; drift: LockDrift } | undefined {
  if (version === 1) {
    return {
      approval: defaultLockApproval(),
      drift: defaultLockDrift(),
    };
  }

  const approval = normalizeLockApproval(record.approval);
  const drift = normalizeLockDrift(record.drift);
  if (!approval || !drift) {
    return undefined;
  }

  return { approval, drift };
}
