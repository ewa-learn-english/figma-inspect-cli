import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { exportContract } from "./export-contract.js";

const mocks = vi.hoisted(() => ({
  getFileNode: vi.fn(),
  listFileComponents: vi.fn(),
}));
vi.mock("../figma-api/get-file-node.js", () => ({
  getFileNode: mocks.getFileNode,
}));
vi.mock("../figma-api/list-file-components.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../figma-api/list-file-components.js")
  >()),
  listFileComponents: mocks.listFileComponents,
}));

let outputDir: string;
beforeEach(async () => {
  outputDir = await mkdtemp(
    path.join(os.tmpdir(), "figma-contract-integration-"),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network request");
    }),
  );
});
afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  await rm(outputDir, { recursive: true, force: true });
});

describe("URL contract export", () => {
  it.each([
    "yaml",
    "json",
  ] as const)("exports complete section source and separate %s contracts from one node response", async (format) => {
    const frame = (id: string) => ({
      id,
      name: "Same screen",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 200 },
      children: [
        {
          id: `${id};1`,
          type: "TEXT",
          name: "Label",
          characters: "Keep all text",
          visible: true,
        },
      ],
    });
    const payload = {
      name: "Design",
      nodes: {
        "1:1": {
          document: {
            id: "1:1",
            name: "Flow",
            type: "SECTION",
            children: [
              frame("2:1"),
              frame("2:2"),
              { id: "3:1", type: "SECTION", children: [frame("4:1")] },
              {
                id: "5:1",
                type: "TEXT",
                characters: "Preserve annotation",
                extraDesignField: "original",
              },
            ],
          },
          components: {},
          componentSets: {},
          styles: { "s:1": { name: "Retain metadata" } },
        },
      },
    };
    mocks.getFileNode.mockResolvedValue(payload);
    const result = await exportContract({
      token: "fixture-token",
      fileKey: "design",
      nodeId: "1:1",
      outputDir,
      format,
    });
    if (!("indexPath" in result)) throw new Error("Expected section export");
    expect(mocks.getFileNode).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(result.sourcePath, "utf8"))).toEqual(
      payload,
    );
    const index = parse(await readFile(result.indexPath, "utf8"));
    expect(index.children).toEqual([
      expect.objectContaining({ id: "2:1", contractDirectory: "2%3A1" }),
      expect.objectContaining({ id: "2:2", contractDirectory: "2%3A2" }),
      expect.objectContaining({ id: "3:1", contractDirectory: "3%3A1" }),
      { id: "5:1", type: "TEXT" },
    ]);
    expect(result.children).toHaveLength(3);
    const nested = result.children[2];
    if (!("indexPath" in nested)) throw new Error("Expected nested section");
    const nestedIndex = parse(await readFile(nested.indexPath, "utf8"));
    expect(
      path.resolve(path.dirname(nested.indexPath), nestedIndex.sourcePath),
    ).toBe(result.sourcePath);
    for (const child of [...result.children.slice(0, 2), ...nested.children]) {
      if (!("structureDslPath" in child))
        throw new Error("Expected frame contract");
      expect(await readFile(child.structureDslPath, "utf8")).toContain("Label");
      expect(
        parse(await readFile(child.visualsContractPath, "utf8")),
      ).toBeTypeOf("object");
      expect(
        parse(await readFile(child.lockContractPath, "utf8")),
      ).toMatchObject({ source: { fileKey: "design", nodeType: "FRAME" } });
    }
  });

  it("exports a component set without team access and retains source identity", async () => {
    mocks.getFileNode.mockResolvedValue({
      nodes: {
        "1:1": {
          document: {
            id: "1:1",
            type: "COMPONENT_SET",
            name: "Badge",
            componentPropertyDefinitions: {
              State: {
                type: "VARIANT",
                defaultValue: "Default",
                variantOptions: ["Default"],
              },
            },
            children: [
              {
                id: "1:2",
                type: "COMPONENT",
                name: "State=Default",
                children: [],
              },
            ],
          },
          componentSets: { "1:1": { key: "badge-key", name: "Badge" } },
          components: {
            "1:2": { name: "State=Default", componentSetId: "1:1" },
          },
        },
      },
    });
    mocks.listFileComponents.mockResolvedValue([]);
    const result = await exportContract({
      token: "fixture-token",
      fileKey: "design",
      nodeId: "1:1",
      outputDir,
    });
    if (!("metaContractPath" in result))
      throw new Error("Expected component contract");
    expect(mocks.getFileNode).toHaveBeenCalledTimes(1);
    expect(mocks.listFileComponents).toHaveBeenCalledWith({
      token: "fixture-token",
      fileKey: "design",
    });
    expect(
      parse(await readFile(result.metaContractPath, "utf8")),
    ).toMatchObject({
      component: { id: "1:1", key: "badge-key", fileKey: "design" },
    });
    expect(
      parse(await readFile(result.lockContractPath, "utf8")),
    ).toMatchObject({
      source: {
        fileKey: "design",
        nodeId: "1:1",
        componentSetKey: "badge-key",
      },
    });
  });
});
