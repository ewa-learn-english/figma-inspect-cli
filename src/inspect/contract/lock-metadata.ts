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

export function normalizeLockVersion(value: unknown): 1 | 2 | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const version = (value as Record<string, unknown>).version;
  return version === 1 || version === 2 ? version : undefined;
}
