import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serializeContractData } from "../contract/contract-format.js";
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
});
