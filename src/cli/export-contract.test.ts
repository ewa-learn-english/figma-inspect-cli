import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveExportContractTarget: vi.fn(),
  exportComponentSet: vi.fn(),
  exportNodeContract: vi.fn(),
}));

vi.mock("../inspect/index.js", () => ({
  resolveExportContractTarget: mocks.resolveExportContractTarget,
}));

vi.mock("./export-component-set.js", () => ({
  exportComponentSet: mocks.exportComponentSet,
}));

vi.mock("./export-node-contract.js", () => ({
  exportNodeContract: mocks.exportNodeContract,
}));

import { exportContract } from "./export-contract.js";

describe("exportContract", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes component sets to exportComponentSet", async () => {
    mocks.resolveExportContractTarget.mockResolvedValue({
      kind: "component-set",
      fileKey: "file-key",
      nodeId: "213:695",
    });
    mocks.exportComponentSet.mockResolvedValue({
      visualsContractPath: "/out/Cell.component-set.visuals.yaml",
      geometryContractPath: "/out/Cell.component-set.geometry.yaml",
      metaContractPath: "/out/Cell.component-set.meta.yaml",
      lockContractPath: "/out/Cell.component-set.lock.yaml",
      structureDslPath: "/out/Cell.component-set.structure.dsl",
    });

    await exportContract({
      token: "token",
      teamId: "team",
      outputDir: "out",
      fileKey: "file-key",
      nodeId: "213:695",
      sourceUrl:
        "https://www.figma.com/design/file-key/Settings?node-id=213-695",
      variablesPath: "vars.json",
      exportAssets: true,
      assetFormat: "svg",
      nestedAssets: { nodeIds: ["401:2"], formats: ["svg"], scale: 2 },
      preview: { format: "webp", scale: 2 },
    });

    expect(mocks.exportComponentSet).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token",
        teamId: "team",
        componentSet: {
          kind: "node",
          fileKey: "file-key",
          nodeId: "213:695",
        },
        exportAssets: true,
        assetFormat: "svg",
        nestedAssets: { nodeIds: ["401:2"], formats: ["svg"], scale: 2 },
        preview: { format: "webp", scale: 2 },
      }),
    );
    expect(mocks.exportNodeContract).not.toHaveBeenCalled();
  });

  it("routes frames and standalone components to exportNodeContract", async () => {
    mocks.resolveExportContractTarget.mockResolvedValue({
      kind: "node",
      fileKey: "file-key",
      nodeId: "208:43935",
    });
    mocks.exportNodeContract.mockResolvedValue({
      visualsContractPath: "/out/Settings.frame.visuals.yaml",
      geometryContractPath: "/out/Settings.frame.geometry.yaml",
      metaContractPath: "/out/Settings.frame.meta.yaml",
      lockContractPath: "/out/Settings.frame.lock.yaml",
      structureDslPath: "/out/Settings.frame.structure.dsl",
    });

    await exportContract({
      token: "token",
      outputDir: "out",
      fileKey: "file-key",
      nodeId: "208:43935",
      sourceUrl:
        "https://www.figma.com/design/file-key/Settings?node-id=208-43935",
      variablesPath: "vars.json",
      nestedAssets: { nodeIds: ["401:2"], formats: ["webp"], scale: 3 },
      preview: { format: "svg" },
    });

    expect(mocks.exportNodeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token",
        fileKey: "file-key",
        nodeId: "208:43935",
        nestedAssets: { nodeIds: ["401:2"], formats: ["webp"], scale: 3 },
        preview: { format: "svg" },
      }),
    );
    expect(mocks.exportComponentSet).not.toHaveBeenCalled();
  });

  it("exports component-set URLs without a team and reuses the resolved node", async () => {
    const entry = { document: { id: "1:1", type: "COMPONENT_SET" } };
    mocks.resolveExportContractTarget.mockResolvedValue({
      kind: "component-set",
      fileKey: "file-key",
      nodeId: "1:1",
      entry,
    });
    await exportContract({
      token: "token",
      outputDir: "out",
      fileKey: "file-key",
      nodeId: "1:1",
    });
    expect(mocks.exportComponentSet).toHaveBeenCalledWith(
      expect.objectContaining({
        entry,
        componentSet: { kind: "node", fileKey: "file-key", nodeId: "1:1" },
      }),
    );
  });

  it("ignores variant asset export for node targets", async () => {
    mocks.resolveExportContractTarget.mockResolvedValue({
      kind: "node",
      fileKey: "file-key",
      nodeId: "208:43935",
    });

    mocks.exportNodeContract.mockResolvedValue({
      visualsContractPath: "/out/Settings.frame.visuals.yaml",
      geometryContractPath: "/out/Settings.frame.geometry.yaml",
      metaContractPath: "/out/Settings.frame.meta.yaml",
      lockContractPath: "/out/Settings.frame.lock.yaml",
      structureDslPath: "/out/Settings.frame.structure.dsl",
    });

    await exportContract({
      token: "token",
      outputDir: "out",
      fileKey: "file-key",
      nodeId: "208:43935",
      variablesPath: "vars.json",
      exportAssets: true,
      assetFormat: "svg",
    });

    expect(mocks.exportNodeContract).toHaveBeenCalledWith(
      expect.not.objectContaining({
        exportAssets: true,
        assetFormat: "svg",
      }),
    );
    expect(mocks.exportComponentSet).not.toHaveBeenCalled();
  });
});
