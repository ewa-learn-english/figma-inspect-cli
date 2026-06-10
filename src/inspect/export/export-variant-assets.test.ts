import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaInspectError } from "../errors.js";
import { exportVariantAssets } from "./export-variant-assets.js";

const tmpFixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../tmp",
);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function profileStreakComponentSet(): Record<string, unknown> {
  return {
    id: "5708:145",
    type: "COMPONENT_SET",
    name: "ProfileStreakIcon",
    componentPropertyDefinitions: {
      Status: {
        type: "VARIANT",
        defaultValue: "Missed",
        variantOptions: ["Active", "Missed", "Loading"],
      },
      Size: {
        type: "VARIANT",
        defaultValue: "M",
        variantOptions: ["M", "XL"],
      },
    },
    children: [
      {
        type: "COMPONENT",
        id: "5708:146",
        name: "Status=Active, Size=M",
        children: [{ type: "RECTANGLE" }],
      },
      {
        type: "COMPONENT",
        id: "5708:250",
        name: "Status=Missed, Size=M",
        children: [{ type: "RECTANGLE" }],
      },
      {
        type: "COMPONENT",
        id: "5708:261",
        name: "Status=Loading, Size=M",
        children: [{ type: "RECTANGLE" }],
      },
      {
        type: "COMPONENT",
        id: "9775:961",
        name: "Status=Active, Size=XL",
        children: [{ type: "RECTANGLE" }],
      },
      {
        type: "COMPONENT",
        id: "9775:952",
        name: "Status=Missed, Size=XL",
        children: [{ type: "RECTANGLE" }],
      },
      {
        type: "COMPONENT",
        id: "9775:973",
        name: "Status=Loading, Size=XL",
        children: [{ type: "RECTANGLE" }],
      },
    ],
  };
}

function svgPayload(width = 48, height = 48): Uint8Array {
  return new TextEncoder().encode(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}"/></svg>`,
  );
}

function createExportFetchMock(
  nodeIds: string[],
  fileKey = "YYQVrmbhmRrraUvQQsT4Zo",
): typeof fetch {
  const imageUrls = Object.fromEntries(
    nodeIds.map((nodeId) => [nodeId, `https://cdn.example/${nodeId}.svg`]),
  );

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/images/")) {
      expect(url).toContain(encodeURIComponent(fileKey));
      return jsonResponse({ images: imageUrls });
    }

    if (url.startsWith("https://cdn.example/")) {
      return new Response(svgPayload(), { status: 200 });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;
}

describe("exportVariantAssets", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports normalized svg assets and builds nested asset map", async () => {
    const outputDir = await mkdtemp(
      path.join(tmpdir(), "figma-export-assets-"),
    );
    const componentSet = profileStreakComponentSet();
    const nodeIds = (componentSet.children as Array<{ id: string }>).map(
      (child) => child.id,
    );
    const fetchImpl = createExportFetchMock(nodeIds);

    const result = await exportVariantAssets({
      token: "token",
      fileKey: "YYQVrmbhmRrraUvQQsT4Zo",
      componentSet,
      baseName: "ProfileStreakIcon",
      outputDir,
      format: "svg",
      fetchImpl,
    });

    expect(result.assetsDir).toBe(
      path.join(outputDir, "ProfileStreakIcon.assets"),
    );
    expect(result.assets.M?.Active).toEqual({
      format: "svg",
      path: "ProfileStreakIcon.assets/active-m.svg",
    });
    expect(result.assets.XL?.Missed).toEqual({
      format: "svg",
      path: "ProfileStreakIcon.assets/missed-xl.svg",
    });

    const activeSvg = await readFile(
      path.join(outputDir, "ProfileStreakIcon.assets/active-m.svg"),
      "utf8",
    );
    expect(activeSvg).toBe(
      '<svg viewBox="0 0 48 48"><rect width="48" height="48"/></svg>',
    );
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("reuses existing svg files for skipped node ids", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-export-skip-"));
    const componentSet = profileStreakComponentSet();
    const assetsDir = path.join(outputDir, "ProfileStreakIcon.assets");
    await mkdir(assetsDir, { recursive: true });

    const existingFiles = [
      "active-m.svg",
      "missed-m.svg",
      "loading-m.svg",
      "active-xl.svg",
      "missed-xl.svg",
      "loading-xl.svg",
    ];
    await Promise.all(
      existingFiles.map((fileName) =>
        writeFile(
          path.join(assetsDir, fileName),
          '<svg viewBox="0 0 1 1"></svg>',
          "utf8",
        ),
      ),
    );

    const fetchImpl = createExportFetchMock([]);
    const nodeIds = (componentSet.children as Array<{ id: string }>).map(
      (child) => child.id,
    );

    const result = await exportVariantAssets({
      token: "token",
      fileKey: "YYQVrmbhmRrraUvQQsT4Zo",
      componentSet,
      baseName: "ProfileStreakIcon",
      outputDir,
      format: "svg",
      skipNodeIds: new Set(nodeIds),
      fetchImpl,
    });

    expect(result.assets.M?.Active?.path).toBe(
      "ProfileStreakIcon.assets/active-m.svg",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exports skipped variants when their svg file is missing", async () => {
    const outputDir = await mkdtemp(
      path.join(tmpdir(), "figma-export-skip-missing-"),
    );
    const componentSet = profileStreakComponentSet();
    const nodeIds = (componentSet.children as Array<{ id: string }>).map(
      (child) => child.id,
    );
    const fetchImpl = createExportFetchMock(nodeIds);

    await exportVariantAssets({
      token: "token",
      fileKey: "YYQVrmbhmRrraUvQQsT4Zo",
      componentSet,
      baseName: "ProfileStreakIcon",
      outputDir,
      format: "svg",
      skipNodeIds: new Set(["5708:146"]),
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalled();
    await expect(
      access(path.join(outputDir, "ProfileStreakIcon.assets/active-m.svg")),
    ).resolves.toBeUndefined();
  });

  it("rejects component sets without exportable variants", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-export-empty-"));

    await expect(
      exportVariantAssets({
        token: "token",
        fileKey: "file-key",
        componentSet: {
          ...profileStreakComponentSet(),
          children: [{ type: "COMPONENT", id: "1:1", name: "Plain" }],
        },
        baseName: "Broken",
        outputDir,
        format: "svg",
        fetchImpl: vi.fn() as typeof fetch,
      }),
    ).rejects.toThrow(/no exportable variants/i);
  });

  it("rejects non-variant component properties before export", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-export-bool-"));

    await expect(
      exportVariantAssets({
        token: "token",
        fileKey: "file-key",
        componentSet: {
          ...profileStreakComponentSet(),
          componentPropertyDefinitions: {
            ...profileStreakComponentSet().componentPropertyDefinitions,
            showLabel: { type: "BOOLEAN", defaultValue: true },
          },
        },
        baseName: "Broken",
        outputDir,
        format: "svg",
        fetchImpl: vi.fn() as typeof fetch,
      }),
    ).rejects.toThrow(FigmaInspectError);
  });

  it("matches tmp ProfileStreakIcon asset paths", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-export-tmp-"));
    const componentSet = profileStreakComponentSet();
    const nodeIds = (componentSet.children as Array<{ id: string }>).map(
      (child) => child.id,
    );

    const result = await exportVariantAssets({
      token: "token",
      fileKey: "YYQVrmbhmRrraUvQQsT4Zo",
      componentSet,
      baseName: "ProfileStreakIcon",
      outputDir,
      format: "svg",
      fetchImpl: createExportFetchMock(nodeIds),
    });

    expect(result.assets).toEqual({
      M: {
        Active: {
          format: "svg",
          path: "ProfileStreakIcon.assets/active-m.svg",
        },
        Loading: {
          format: "svg",
          path: "ProfileStreakIcon.assets/loading-m.svg",
        },
        Missed: {
          format: "svg",
          path: "ProfileStreakIcon.assets/missed-m.svg",
        },
      },
      XL: {
        Active: {
          format: "svg",
          path: "ProfileStreakIcon.assets/active-xl.svg",
        },
        Loading: {
          format: "svg",
          path: "ProfileStreakIcon.assets/loading-xl.svg",
        },
        Missed: {
          format: "svg",
          path: "ProfileStreakIcon.assets/missed-xl.svg",
        },
      },
    });

    const tmpAsset = path.join(
      tmpFixtures,
      "ProfileStreakIcon.assets/active-m.svg",
    );
    await expect(access(tmpAsset)).resolves.toBeUndefined();
  });
});
