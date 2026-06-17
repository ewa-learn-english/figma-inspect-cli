import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchFileNodeEntry: vi.fn(),
}));

vi.mock("./fetch-file-node-entry.js", () => ({
  fetchFileNodeEntry: mocks.fetchFileNodeEntry,
}));

import { resolveExportContractTarget } from "./export-contract-target.js";

describe("resolveExportContractTarget", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes component set nodes to the component-set pipeline", async () => {
    mocks.fetchFileNodeEntry.mockResolvedValue({
      document: {
        id: "213:695",
        name: "Cell",
        type: "COMPONENT_SET",
        isExposedInstance: false,
      },
      componentSets: {},
      components: {},
    });

    await expect(
      resolveExportContractTarget({
        token: "token",
        fileKey: "file-key",
        nodeId: "213:695",
      }),
    ).resolves.toEqual({
      kind: "component-set",
      fileKey: "file-key",
      nodeId: "213:695",
    });
  });

  it("routes frame nodes to the node pipeline", async () => {
    mocks.fetchFileNodeEntry.mockResolvedValue({
      document: {
        id: "208:43935",
        name: "Settings",
        type: "FRAME",
        isExposedInstance: false,
      },
      componentSets: {},
      components: {},
    });

    await expect(
      resolveExportContractTarget({
        token: "token",
        fileKey: "file-key",
        nodeId: "208:43935",
      }),
    ).resolves.toEqual({
      kind: "node",
      fileKey: "file-key",
      nodeId: "208:43935",
    });
  });

  it("routes standalone components to the node pipeline", async () => {
    mocks.fetchFileNodeEntry.mockResolvedValue({
      document: {
        id: "900:1",
        name: "Icon",
        type: "COMPONENT",
        isExposedInstance: false,
      },
      componentSets: {},
      components: {
        "900:1": { key: "component-key", name: "Icon" },
      },
    });

    await expect(
      resolveExportContractTarget({
        token: "token",
        fileKey: "file-key",
        nodeId: "900:1",
      }),
    ).resolves.toEqual({
      kind: "node",
      fileKey: "file-key",
      nodeId: "900:1",
    });
  });

  it("rejects components inside component sets", async () => {
    mocks.fetchFileNodeEntry.mockResolvedValue({
      document: {
        id: "3971:6466",
        name: "State=Default",
        type: "COMPONENT",
        isExposedInstance: false,
      },
      componentSets: {},
      components: {
        "3971:6466": {
          key: "component-key",
          name: "State=Default",
          componentSetId: "3971:6465",
        },
      },
    });

    await expect(
      resolveExportContractTarget({
        token: "token",
        fileKey: "file-key",
        nodeId: "3971:6466",
      }),
    ).rejects.toThrow(/use --export-component-set/);
  });

  it("rejects unsupported nodes with the actual node type", async () => {
    mocks.fetchFileNodeEntry.mockResolvedValue({
      document: {
        id: "500:1",
        name: "Nested",
        type: "INSTANCE",
        isExposedInstance: false,
      },
      componentSets: {},
      components: {},
    });

    await expect(
      resolveExportContractTarget({
        token: "token",
        fileKey: "file-key",
        nodeId: "500:1",
      }),
    ).rejects.toThrow(/INSTANCE/);
  });
});
