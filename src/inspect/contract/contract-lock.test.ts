import { describe, expect, it } from "vitest";
import {
  diffContractLock,
  isContractLockDiffEmpty,
  toLockVariants,
  type ContractLock,
} from "./contract-lock.js";

const baseLock: ContractLock = {
  version: 1,
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
};

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

describe("diffContractLock", () => {
  it("reports no diff when live matches lock", () => {
    const diff = diffContractLock(baseLock, {
      source: baseLock.source,
      variants: baseLock.variants,
      treeFingerprint: "tree-hash",
    });
    expect(isContractLockDiffEmpty(diff)).toBe(true);
  });

  it("reports source and tree drift", () => {
    const diff = diffContractLock(baseLock, {
      source: {
        ...baseLock.source,
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
          key: "v1",
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
