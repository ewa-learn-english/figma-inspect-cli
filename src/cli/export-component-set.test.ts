import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const mocks = vi.hoisted(() => ({
  resolveTeamComponentSetScope: vi.fn(),
  loadComponentSetContext: vi.fn(),
  buildComponentSetPseudocodeFromRaw: vi.fn(),
  exportVariantAssets: vi.fn(),
  exportNodePreview: vi.fn(),
  getComponentSetByKey: vi.fn(),
  listFileComponents: vi.fn(),
  filterFileComponentsForComponentSet: vi.fn(),
}));

vi.mock("../inspect/index.js", () => ({
  resolveTeamComponentSetScope: mocks.resolveTeamComponentSetScope,
  loadComponentSetContext: mocks.loadComponentSetContext,
  buildComponentSetPseudocodeFromRaw: mocks.buildComponentSetPseudocodeFromRaw,
  exportVariantAssets: mocks.exportVariantAssets,
  exportNodePreview: mocks.exportNodePreview,
}));

vi.mock("../figma-api/index.js", () => ({
  getComponentSetByKey: mocks.getComponentSetByKey,
  listFileComponents: mocks.listFileComponents,
  filterFileComponentsForComponentSet:
    mocks.filterFileComponentsForComponentSet,
}));

import { contractFixturesDir, variablesFixturePath } from "../test/fixtures.js";
import { exportComponentSet } from "./export-component-set.js";

async function loadFixture<T>(fileName: string): Promise<T> {
  const content = await readFile(
    path.join(contractFixturesDir, fileName),
    "utf8",
  );
  if (fileName.endsWith(".yaml")) {
    return parse(content) as T;
  }

  return content as T;
}

describe("exportComponentSet", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(path.join(os.tmpdir(), "figma-export-test-"));

    const [visuals, geometry, meta, structureDsl] = await Promise.all([
      loadFixture<Record<string, unknown>>(
        "TextInput.component-set.visuals.yaml",
      ),
      loadFixture<Record<string, unknown>>(
        "TextInput.component-set.geometry.yaml",
      ),
      loadFixture<Record<string, unknown>>("TextInput.component-set.meta.yaml"),
      loadFixture<string>("TextInput.component-set.structure.dsl"),
    ]);

    mocks.resolveTeamComponentSetScope.mockResolvedValue({
      fileKey: "file-key",
      nodeId: "3971:6465",
      publishedSet: {
        id: "3971:6465",
        key: "component-set-key",
        name: "TextInput",
        fileKey: "file-key",
        projectId: "583677607",
      },
      teamComponents: [],
    });
    mocks.loadComponentSetContext.mockResolvedValue({
      tree: {
        id: "3971:6465",
        type: "COMPONENT_SET",
        name: "TextInput",
      },
    });
    mocks.getComponentSetByKey.mockResolvedValue({
      key: "component-set-key",
      node_id: "3971:6465",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    mocks.listFileComponents.mockResolvedValue([]);
    mocks.filterFileComponentsForComponentSet.mockReturnValue([
      {
        key: "variant-key",
        node_id: "3971:6466",
        name: "State=Default",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mocks.buildComponentSetPseudocodeFromRaw.mockResolvedValue({
      visuals,
      geometry,
      meta,
      structureDsl,
    });
    mocks.exportVariantAssets.mockImplementation(async (options) => {
      const assetsDir = path.join(
        options.outputDir,
        `${options.baseName}.assets`,
      );
      await mkdir(assetsDir, { recursive: true });
      await writeFile(path.join(assetsDir, "default.svg"), "<svg/>", "utf8");
      return { assetsDir, assets: {} };
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

  it("writes contract artifacts and lock file for a team component set lookup by name", async () => {
    const result = await exportComponentSet({
      token: "token",
      teamId: "team-id",
      outputDir,
      componentSet: { kind: "name", value: "TextInput" },
      variablesPath: variablesFixturePath,
    });

    expect(result.metaContractPath).toBe(
      path.join(outputDir, "TextInput.component-set.meta.yaml"),
    );
    expect(result.lockContractPath).toBe(
      path.join(outputDir, "TextInput.component-set.lock.yaml"),
    );

    const lock = parse(await readFile(result.lockContractPath, "utf8")) as {
      version: number;
      kind: string;
      source: { fileKey: string; nodeType?: string; componentSetKey: string };
      fingerprints: { contractSurface?: string };
      variants: Array<{ key: string }>;
    };
    expect(lock.version).toBe(2);
    expect(lock.kind).toBe("component-set");
    expect(lock.source.fileKey).toBe("file-key");
    expect(lock.source.nodeType).toBe("COMPONENT_SET");
    expect(lock.source.componentSetKey).toBe("component-set-key");
    expect(lock.fingerprints.contractSurface).toMatch(/^[a-f0-9]{64}$/);
    expect(lock.variants).toEqual([
      {
        key: "variant-key",
        nodeId: "3971:6466",
        name: "State=Default",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(mocks.buildComponentSetPseudocodeFromRaw).toHaveBeenCalledWith(
      expect.objectContaining({ name: "TextInput", type: "COMPONENT_SET" }),
      expect.objectContaining({
        variablesPath: variablesFixturePath,
        format: "yaml",
        metaContext: expect.objectContaining({
          component: expect.objectContaining({ name: "TextInput" }),
        }),
      }),
    );
  });

  it("writes import notes for URL exports", async () => {
    const sourceUrl =
      "https://www.figma.com/design/file-key/Settings?node-id=3971-6465&m=dev";
    const result = await exportComponentSet({
      token: "token",
      teamId: "team-id",
      outputDir,
      componentSet: {
        kind: "node",
        fileKey: "file-key",
        nodeId: "3971:6465",
      },
      sourceUrl,
      variablesPath: variablesFixturePath,
    });

    expect(mocks.resolveTeamComponentSetScope).toHaveBeenCalledWith({
      token: "token",
      teamId: "team-id",
      componentSet: {
        kind: "node",
        fileKey: "file-key",
        nodeId: "3971:6465",
      },
    });
    expect(result.importNotesPath).toBe(
      path.join(outputDir, "import-notes.md"),
    );
    await expect(readFile(result.importNotesPath ?? "", "utf8")).resolves.toBe(
      [
        "# Import Notes",
        "",
        `sourceUrl: ${JSON.stringify(sourceUrl)}`,
        'fileKey: "file-key"',
        'nodeId: "3971:6465"',
        'componentSetKey: "component-set-key"',
        'componentSetName: "TextInput"',
        "",
      ].join("\n"),
    );
  });

  it("exports assets and fingerprints them when exportAssets is enabled", async () => {
    const result = await exportComponentSet({
      token: "token",
      teamId: "team-id",
      outputDir,
      componentSet: { kind: "key", value: "component-set-key" },
      variablesPath: variablesFixturePath,
      exportAssets: true,
      assetFormat: "svg",
    });

    expect(mocks.exportVariantAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token",
        fileKey: "file-key",
        format: "svg",
      }),
    );
    expect(result.assetsDir).toBe(path.join(outputDir, "TextInput.assets"));
    expect(result.metaContractPath).toBe(
      path.join(outputDir, "TextInput.component-set.meta.yaml"),
    );

    const lock = parse(await readFile(result.lockContractPath, "utf8")) as {
      fingerprints: { assets?: Record<string, string> };
    };
    expect(lock.fingerprints.assets?.default).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exports a root preview when preview is enabled", async () => {
    const result = await exportComponentSet({
      token: "token",
      teamId: "team-id",
      outputDir,
      componentSet: { kind: "key", value: "component-set-key" },
      variablesPath: variablesFixturePath,
      preview: { format: "png", scale: 2 },
    });

    expect(mocks.exportNodePreview).toHaveBeenCalledWith({
      token: "token",
      fileKey: "file-key",
      nodeId: "3971:6465",
      baseName: "TextInput",
      kind: "component-set",
      outputDir,
      preview: { format: "png", scale: 2 },
    });
    expect(result.previewPath).toBe(
      path.join(outputDir, "TextInput.component-set.preview.png"),
    );
  });
});
