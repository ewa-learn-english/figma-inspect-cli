import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serializeContractData } from "../contract/contract-format.js";
import {
  fingerprintContractSurface,
  fingerprintTree,
} from "../contract/fingerprint.js";
import { writeNodeContractLock } from "./node-lock.js";
import {
  resolveNodeContractLockPath,
  resolveNodeGeometryContractPath,
  resolveNodeMetaContractPath,
  resolveNodeStructureDslPath,
  resolveNodeVisualsContractPath,
} from "./paths.js";

const mocks = vi.hoisted(() => ({
  fetchFileNodeEntry: vi.fn(),
}));

vi.mock("../fetch-file-node-entry.js", () => ({
  fetchFileNodeEntry: mocks.fetchFileNodeEntry,
}));

import { verifyNodeContracts } from "./verify-node-contract.js";

const baseLock = {
  version: 1 as const,
  kind: "frame" as const,
  source: {
    fileKey: "file-key",
    nodeId: "208:43935",
    nodeType: "FRAME" as const,
    name: "Settings",
  },
  fingerprints: {
    tree: "locked-tree",
    contracts: "locked-contracts",
  },
  dependencies: {
    componentSets: [],
    components: [],
  },
};

function baseV2Lock(tree: Record<string, unknown>) {
  return {
    ...baseLock,
    version: 2 as const,
    fingerprints: {
      tree: fingerprintTree(tree),
      contractSurface: fingerprintContractSurface(tree),
      contracts: baseLock.fingerprints.contracts,
    },
    approval: {
      status: "unverified" as const,
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
}

async function writeNodeArtifacts(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolveNodeMetaContractPath(directory, "Settings", "frame"),
    serializeContractData(
      {
        version: 1,
        kind: "frame",
        node: { id: "208:43935", name: "Settings", type: "FRAME" },
        dependencies: { componentSets: [], components: [] },
      },
      "yaml",
    ),
    "utf8",
  );
  await writeFile(
    resolveNodeGeometryContractPath(directory, "Settings", "frame"),
    serializeContractData({ root: { width: 390 } }, "yaml"),
    "utf8",
  );
  await writeFile(
    resolveNodeVisualsContractPath(directory, "Settings", "frame"),
    serializeContractData({ root: { background: "#ffffff" } }, "yaml"),
    "utf8",
  );
  await writeFile(
    resolveNodeStructureDslPath(directory, "Settings", "frame"),
    [
      'node frame "Settings"',
      "",
      "contracts {",
      "  visuals Settings.frame.visuals.yaml",
      "  geometry Settings.frame.geometry.yaml",
      "  meta Settings.frame.meta.yaml",
      "}",
      "",
      "resolve {",
      "  scheme = visuals",
      "  geometry = geometry",
      "}",
      "",
      "tree {",
      '  frame root "Settings"',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

describe("verifyNodeContracts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports tree drift for node locks", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "figma-node-verify-test-"),
    );
    await writeNodeArtifacts(directory);
    await writeNodeContractLock(
      resolveNodeContractLockPath(directory, "Settings", "frame"),
      baseLock,
    );
    mocks.fetchFileNodeEntry.mockResolvedValue({
      document: {
        id: "208:43935",
        name: "Settings",
        type: "FRAME",
        isExposedInstance: false,
        absoluteBoundingBox: { width: 391, height: 844 },
      },
      componentSets: {},
      components: {},
    });

    const results = await verifyNodeContracts({
      token: "token",
      contractDir: directory,
      nodeName: "Settings",
    });

    expect(results).toEqual([
      {
        nodeName: "Settings",
        kind: "frame",
        status: "changed",
        errors: [],
        changed: {
          source: false,
          tree: true,
          contractSurface: true,
          kind: false,
        },
      },
    ]);
    expect(mocks.fetchFileNodeEntry).toHaveBeenCalledWith({
      token: "token",
      fileKey: "file-key",
      nodeId: "208:43935",
      fetchImpl: expect.any(Function),
    });
  });

  it("ignores canvas position drift for v2 node locks", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "figma-node-verify-v2-test-"),
    );
    const tree = {
      id: "208:43935",
      name: "Settings",
      type: "FRAME",
      isExposedInstance: false,
      absoluteBoundingBox: { x: 10, y: 20, width: 390, height: 844 },
    };
    const movedTree = {
      ...tree,
      absoluteBoundingBox: { x: 900, y: 1200, width: 390, height: 844 },
    };

    await writeNodeArtifacts(directory);
    await writeNodeContractLock(
      resolveNodeContractLockPath(directory, "Settings", "frame"),
      baseV2Lock(tree),
    );
    mocks.fetchFileNodeEntry.mockResolvedValue({
      document: movedTree,
      componentSets: {},
      components: {},
    });

    const results = await verifyNodeContracts({
      token: "token",
      contractDir: directory,
      nodeName: "Settings",
    });

    expect(fingerprintTree(movedTree)).not.toBe(fingerprintTree(tree));
    expect(fingerprintContractSurface(movedTree)).toBe(
      fingerprintContractSurface(tree),
    );
    expect(results).toEqual([
      {
        nodeName: "Settings",
        kind: "frame",
        status: "ok",
        errors: [],
        changed: {
          source: false,
          tree: false,
          contractSurface: false,
          kind: false,
        },
      },
    ]);
  });

  it("returns an error for v2 node locks with missing approval metadata", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "figma-node-verify-invalid-v2-"),
    );
    const tree = {
      id: "208:43935",
      name: "Settings",
      type: "FRAME",
      isExposedInstance: false,
      absoluteBoundingBox: { width: 390, height: 844 },
    };
    const { approval: _approval, ...invalidLock } = baseV2Lock(tree);

    await writeNodeArtifacts(directory);
    await writeFile(
      resolveNodeContractLockPath(directory, "Settings", "frame"),
      serializeContractData(invalidLock, "yaml"),
      "utf8",
    );

    const results = await verifyNodeContracts({
      token: "token",
      contractDir: directory,
      nodeName: "Settings",
    });

    expect(results).toEqual([
      {
        nodeName: "Settings",
        kind: "frame",
        status: "error",
        errors: [
          `Invalid node contract lock file: ${resolveNodeContractLockPath(directory, "Settings", "frame")}`,
        ],
        changed: {
          source: false,
          tree: false,
          contractSurface: false,
          kind: false,
        },
      },
    ]);
    expect(mocks.fetchFileNodeEntry).not.toHaveBeenCalled();
  });
});
