import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contractFixturesDir } from "../../test/fixtures.js";
import { serializeContractData } from "./contract-format.js";
import {
  buildContractLock,
  type ContractLock,
  collectUnchangedVariantNodeIds,
  diffContractLock,
  isContractLockDiffEmpty,
  readContractLock,
  resolveContractLockPath,
  stabilizeContractLockDates,
  toLockVariants,
} from "./contract-lock.js";

const contractDir = contractFixturesDir;

const baseLock: ContractLock = {
  version: 1,
  kind: "component-set",
  source: {
    fileKey: "abc",
    nodeId: "1:2",
    componentSetKey: "key1",
    componentSetUpdatedAt: "2026-01-01T00:00:00.000Z",
  },
  variants: [
    {
      key: "v1",
      nodeId: "1:3",
      name: "State=Default",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  fingerprints: {
    tree: "tree-hash",
    contracts: "contracts-hash",
  },
  approval: {
    status: "unverified",
    verifiedAt: null,
    verifiedBy: null,
    baselineRevision: null,
  },
  drift: {
    lastCheckedAt: null,
    metadataChanged: false,
    sourceChanged: false,
    structureChanged: false,
    visualsChanged: false,
  },
};

describe("resolveContractLockPath", () => {
  it("points at the lock yaml next to other contract artifacts", () => {
    expect(resolveContractLockPath(contractDir, "TextInput")).toBe(
      path.join(contractDir, "TextInput.component-set.lock.yaml"),
    );
  });
});

describe("readContractLock", () => {
  it("loads TextInput lock metadata from fixtures", async () => {
    const lock = await readContractLock(
      resolveContractLockPath(contractDir, "TextInput"),
    );

    expect(lock?.source.fileKey).toBe("O7aE7SeG2TRBCK5MsjkG7z");
    expect(lock?.variants.length).toBeGreaterThan(0);
    expect(lock?.fingerprints.tree.length).toBeGreaterThan(0);
  });

  it("returns undefined when the lock file is missing", async () => {
    await expect(
      readContractLock(
        path.join(contractDir, "Missing.component-set.lock.yaml"),
      ),
    ).resolves.toBeUndefined();
  });

  it("adds approval and drift defaults only when reading v1 locks", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "figma-lock-v1-"));
    const lockPath = resolveContractLockPath(directory, "Cell");
    await writeFile(
      lockPath,
      serializeContractData(
        {
          version: 1,
          source: baseLock.source,
          variants: baseLock.variants,
          fingerprints: baseLock.fingerprints,
        },
        "yaml",
      ),
      "utf8",
    );

    const lock = await readContractLock(lockPath);

    expect(lock).toMatchObject({
      version: 1,
      approval: baseLock.approval,
      drift: baseLock.drift,
    });
  });

  it("rejects v2 locks with missing approval or drift metadata", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "figma-lock-v2-"));
    const lockPath = resolveContractLockPath(directory, "Cell");
    const lock = buildContractLock({
      source: baseLock.source,
      variants: baseLock.variants,
      fingerprints: {
        tree: "tree-hash",
        contractSurface: "surface-hash",
        contracts: "contracts-hash",
      },
    });
    const { approval: _approval, ...invalidLock } = lock;
    await writeFile(
      lockPath,
      serializeContractData(invalidLock, "yaml"),
      "utf8",
    );

    await expect(readContractLock(lockPath)).rejects.toThrow(
      /Invalid contract lock file/,
    );
  });
});

describe("toLockVariants", () => {
  it("maps file component fields to lock variant shape", () => {
    expect(
      toLockVariants([
        {
          key: "k",
          node_id: "1:10",
          name: "A",
          updated_at: "t",
        },
      ]),
    ).toEqual([
      {
        key: "k",
        nodeId: "1:10",
        name: "A",
        updatedAt: "t",
      },
    ]);
  });
});

describe("buildContractLock", () => {
  it("writes component-set lock v2 with contract surface defaults", () => {
    const lock = buildContractLock({
      source: baseLock.source,
      variants: baseLock.variants,
      fingerprints: {
        tree: "tree-hash",
        contractSurface: "surface-hash",
        contracts: "contracts-hash",
      },
    });

    expect(lock).toMatchObject({
      version: 2,
      kind: "component-set",
      source: { nodeType: "COMPONENT_SET" },
      fingerprints: {
        tree: "tree-hash",
        contractSurface: "surface-hash",
        contracts: "contracts-hash",
      },
      approval: {
        status: "unverified",
        verifiedAt: null,
        verifiedBy: null,
        baselineRevision: null,
      },
      drift: {
        lastCheckedAt: null,
        metadataChanged: false,
        sourceChanged: false,
        structureChanged: false,
        visualsChanged: false,
      },
    });
  });
});

describe("diffContractLock", () => {
  it("reports no diff when live matches lock", () => {
    const diff = diffContractLock(baseLock, {
      source: baseLock.source,
      variants: baseLock.variants,
      treeFingerprint: "tree-hash",
    });
    expect(isContractLockDiffEmpty(diff)).toBe(true);
  });

  it("ignores raw tree drift when contract surface matches", () => {
    const lock = {
      ...baseLock,
      version: 2 as const,
      fingerprints: {
        ...baseLock.fingerprints,
        contractSurface: "surface-hash",
      },
    };
    const diff = diffContractLock(lock, {
      source: lock.source,
      variants: lock.variants,
      treeFingerprint: "other-tree",
      contractSurfaceFingerprint: "surface-hash",
    });

    expect(isContractLockDiffEmpty(diff)).toBe(true);
    expect(diff.tree).toBe(false);
    expect(diff.contractSurface).toBe(false);
  });

  it("reports contract surface drift", () => {
    const lock = {
      ...baseLock,
      version: 2 as const,
      fingerprints: {
        ...baseLock.fingerprints,
        contractSurface: "surface-hash",
      },
    };
    const diff = diffContractLock(lock, {
      source: lock.source,
      variants: lock.variants,
      treeFingerprint: "tree-hash",
      contractSurfaceFingerprint: "other-surface",
    });

    expect(diff.contractSurface).toBe(true);
    expect(isContractLockDiffEmpty(diff)).toBe(false);
  });

  it("ignores timestamp drift when identity and tree match", () => {
    const diff = diffContractLock(baseLock, {
      source: {
        ...baseLock.source,
        componentSetUpdatedAt: "2026-02-01T00:00:00.000Z",
      },
      variants: baseLock.variants.map((variant) => ({
        ...variant,
        updatedAt: "2026-02-01T00:00:00.000Z",
      })),
      treeFingerprint: "tree-hash",
    });

    expect(isContractLockDiffEmpty(diff)).toBe(true);
  });

  it("reports source identity and tree drift", () => {
    const diff = diffContractLock(baseLock, {
      source: {
        ...baseLock.source,
        nodeId: "9:9",
        componentSetUpdatedAt: "2026-02-01T00:00:00.000Z",
      },
      variants: baseLock.variants,
      treeFingerprint: "other-tree",
    });
    expect(diff.source).toBe(true);
    expect(diff.tree).toBe(true);
    expect(isContractLockDiffEmpty(diff)).toBe(false);
  });

  it("reports changed, added, and removed variants", () => {
    const diff = diffContractLock(baseLock, {
      source: baseLock.source,
      variants: [
        {
          key: "v1-renamed",
          nodeId: "1:3",
          name: "State=Default",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
        {
          key: "v2",
          nodeId: "1:4",
          name: "State=Hover",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      treeFingerprint: "tree-hash",
    });
    expect(diff.variants).toEqual(["State=Default"]);
    expect(diff.addedVariants).toEqual(["State=Hover"]);
    expect(diff.removedVariants).toEqual([]);
  });
});

describe("collectUnchangedVariantNodeIds", () => {
  it("reuses variants with changed timestamps when the tree fingerprint is unchanged", () => {
    const variants = baseLock.variants.map((variant) => ({
      ...variant,
      updatedAt: "2026-02-01T00:00:00.000Z",
    }));

    expect(
      collectUnchangedVariantNodeIds(baseLock, variants, "tree-hash"),
    ).toEqual(new Set(["1:3"]));
  });

  it("falls back to updatedAt when the tree fingerprint changed", () => {
    const variants = baseLock.variants.map((variant) => ({
      ...variant,
      updatedAt: "2026-02-01T00:00:00.000Z",
    }));

    expect(
      collectUnchangedVariantNodeIds(baseLock, variants, "other-tree"),
    ).toEqual(new Set());
  });
});

describe("stabilizeContractLockDates", () => {
  it("preserves previous timestamps when the tree fingerprint is unchanged", () => {
    const next = {
      ...baseLock,
      source: {
        ...baseLock.source,
        componentSetUpdatedAt: "2026-02-01T00:00:00.000Z",
      },
      variants: baseLock.variants.map((variant) => ({
        ...variant,
        updatedAt: "2026-02-01T00:00:00.000Z",
      })),
    };

    expect(stabilizeContractLockDates(baseLock, next)).toEqual(baseLock);
  });

  it("keeps fresh timestamps when the tree fingerprint changed", () => {
    const next = {
      ...baseLock,
      source: {
        ...baseLock.source,
        componentSetUpdatedAt: "2026-02-01T00:00:00.000Z",
      },
      variants: baseLock.variants.map((variant) => ({
        ...variant,
        updatedAt: "2026-02-01T00:00:00.000Z",
      })),
      fingerprints: {
        ...baseLock.fingerprints,
        tree: "other-tree",
      },
    };

    expect(stabilizeContractLockDates(baseLock, next)).toEqual(next);
  });
});
