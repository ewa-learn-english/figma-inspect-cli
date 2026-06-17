import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const mocks = vi.hoisted(() => ({
  buildNodeContractFromRef: vi.fn(),
  exportNodePreview: vi.fn(),
}));

vi.mock("../inspect/index.js", async () => {
  const actual = await vi.importActual<typeof import("../inspect/index.js")>(
    "../inspect/index.js",
  );
  return {
    ...actual,
    buildNodeContractFromRef: mocks.buildNodeContractFromRef,
    exportNodePreview: mocks.exportNodePreview,
  };
});

import { exportNodeContract } from "./export-node-contract.js";

describe("exportNodeContract", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(
      path.join(os.tmpdir(), "figma-node-export-test-"),
    );
    mocks.buildNodeContractFromRef.mockResolvedValue({
      nodeName: "Settings",
      kind: "frame",
      source: {
        fileKey: "file-key",
        nodeId: "208:43935",
        nodeType: "FRAME",
        name: "Settings",
      },
      rawNode: {
        id: "208:43935",
        name: "Settings",
        type: "FRAME",
        isExposedInstance: false,
      },
      visuals: { root: { background: "#ffffff" } },
      geometry: { root: { width: 390 } },
      meta: {
        version: 1,
        kind: "frame",
        node: { id: "208:43935", name: "Settings", type: "FRAME" },
        dependencies: { componentSets: [], components: [] },
      },
      structureDsl: [
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
      lock: {
        version: 2,
        kind: "frame",
        source: {
          fileKey: "file-key",
          nodeId: "208:43935",
          nodeType: "FRAME",
          name: "Settings",
        },
        fingerprints: {
          tree: "tree",
          contractSurface: "surface",
          contracts: "contracts",
        },
        dependencies: { componentSets: [], components: [] },
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
      },
    });
    mocks.exportNodePreview.mockImplementation(async (options) => ({
      previewPath: path.join(
        options.outputDir,
        `${options.baseName}.${options.kind}.preview.${options.preview.format}`,
      ),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes frame contract artifacts and lock", async () => {
    const sourceUrl =
      "https://www.figma.com/design/file-key/Settings?node-id=208-43935&m=dev";
    const result = await exportNodeContract({
      token: "token",
      outputDir,
      fileKey: "file-key",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
    });

    expect(result).toMatchObject({
      visualsContractPath: path.join(outputDir, "Settings.frame.visuals.yaml"),
      geometryContractPath: path.join(
        outputDir,
        "Settings.frame.geometry.yaml",
      ),
      metaContractPath: path.join(outputDir, "Settings.frame.meta.yaml"),
      lockContractPath: path.join(outputDir, "Settings.frame.lock.yaml"),
      structureDslPath: path.join(outputDir, "Settings.frame.structure.dsl"),
      importNotesPath: path.join(outputDir, "import-notes.md"),
    });
    expect(mocks.buildNodeContractFromRef).toHaveBeenCalledWith({
      token: "token",
      fileKey: "file-key",
      nodeId: "208:43935",
      sourceUrl,
      variablesPath: "vars.json",
      format: "yaml",
    });

    const lock = parse(await readFile(result.lockContractPath, "utf8")) as {
      version: number;
      kind: string;
      fingerprints: { contractSurface?: string };
      source: { nodeType: string };
    };
    expect(lock.version).toBe(2);
    expect(lock.kind).toBe("frame");
    expect(lock.fingerprints.contractSurface).toBe("surface");
    expect(lock.source.nodeType).toBe("FRAME");
    await expect(readFile(result.importNotesPath ?? "", "utf8")).resolves.toBe(
      [
        "# Import Notes",
        "",
        `sourceUrl: ${JSON.stringify(sourceUrl)}`,
        'fileKey: "file-key"',
        'nodeId: "208:43935"',
        'nodeType: "FRAME"',
        'nodeName: "Settings"',
        'kind: "frame"',
        "",
      ].join("\n"),
    );
  });

  it("exports a root preview when preview is enabled", async () => {
    const result = await exportNodeContract({
      token: "token",
      outputDir,
      fileKey: "file-key",
      nodeId: "208:43935",
      variablesPath: "vars.json",
      preview: { format: "svg" },
    });

    expect(mocks.exportNodePreview).toHaveBeenCalledWith({
      token: "token",
      fileKey: "file-key",
      nodeId: "208:43935",
      baseName: "Settings",
      kind: "frame",
      outputDir,
      preview: { format: "svg" },
    });
    expect(result.previewPath).toBe(
      path.join(outputDir, "Settings.frame.preview.svg"),
    );
  });
});
