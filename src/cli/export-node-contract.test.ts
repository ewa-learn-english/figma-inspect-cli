import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const mocks = vi.hoisted(() => ({
  buildNodeContractFromRef: vi.fn(),
}));

vi.mock("../inspect/index.js", async () => {
  const actual = await vi.importActual<typeof import("../inspect/index.js")>(
    "../inspect/index.js",
  );
  return {
    ...actual,
    buildNodeContractFromRef: mocks.buildNodeContractFromRef,
  };
});

import {
  exportNodeContract,
  writeNodeExportResult,
} from "./export-node-contract.js";

describe("writeNodeExportResult", () => {
  it("writes node contract paths on separate lines", () => {
    let output = "";
    const stdout = {
      write(chunk: string): boolean {
        output += chunk;
        return true;
      },
    } as NodeJS.WriteStream;

    writeNodeExportResult(
      {
        visualsContractPath: "/out/Settings.frame.visuals.yaml",
        geometryContractPath: "/out/Settings.frame.geometry.yaml",
        metaContractPath: "/out/Settings.frame.meta.yaml",
        lockContractPath: "/out/Settings.frame.lock.yaml",
        structureDslPath: "/out/Settings.frame.structure.dsl",
        importNotesPath: "/out/import-notes.md",
      },
      stdout,
    );

    expect(output).toBe(
      `${[
        "/out/Settings.frame.visuals.yaml",
        "/out/Settings.frame.geometry.yaml",
        "/out/Settings.frame.meta.yaml",
        "/out/Settings.frame.lock.yaml",
        "/out/Settings.frame.structure.dsl",
        "/out/import-notes.md",
      ].join("\n")}\n`,
    );
  });
});

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
        version: 1,
        kind: "frame",
        source: {
          fileKey: "file-key",
          nodeId: "208:43935",
          nodeType: "FRAME",
          name: "Settings",
        },
        fingerprints: { tree: "tree", contracts: "contracts" },
        dependencies: { componentSets: [], components: [] },
      },
    });
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
      kind: string;
      source: { nodeType: string };
    };
    expect(lock.kind).toBe("frame");
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
});
