import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { FigmaInspectError } from "../errors.js";
import { exportNestedAssets } from "./export-nested-assets.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pngPayload(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function svgPayload(): Uint8Array {
  return new TextEncoder().encode(
    '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
  );
}

const rootNode = {
  id: "208:43935",
  name: "Settings",
  type: "FRAME",
  children: [
    {
      id: "208:44000",
      name: "Header",
      type: "FRAME",
      children: [
        {
          id: "208:44001",
          name: "Settings icon",
          type: "VECTOR",
        },
        {
          id: "208:44002",
          name: "Vector 1",
          type: "VECTOR",
        },
      ],
    },
    {
      id: "208:44003",
      name: "Brand logo",
      type: "INSTANCE",
    },
  ],
};

describe("exportNestedAssets", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports selected nested nodes and writes a manifest", async () => {
    const outputDir = await mkdtemp(
      path.join(tmpdir(), "figma-nested-assets-"),
    );
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/images/")) {
        const parsed = new URL(url);
        const ids = parsed.searchParams.get("ids")?.split(",") ?? [];
        const format = parsed.searchParams.get("format");

        expect(ids).toEqual(["208:44001", "208:44003"]);
        if (format === "png") {
          expect(parsed.searchParams.get("scale")).toBe("3");
        } else {
          expect(parsed.searchParams.has("scale")).toBe(false);
        }

        return jsonResponse({
          images: Object.fromEntries(
            ids.map((id) => [id, `https://cdn.example/${id}.${format}`]),
          ),
        });
      }

      if (url.endsWith(".svg")) {
        return new Response(svgPayload(), { status: 200 });
      }

      if (url.endsWith(".png")) {
        return new Response(pngPayload(), { status: 200 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const result = await exportNestedAssets({
      token: "token",
      fileKey: "file-key",
      root: rootNode,
      baseName: "Settings",
      kind: "frame",
      outputDir,
      nestedAssets: {
        nodeIds: ["208:44003"],
        includeRegex: "icon",
        nodeTypes: ["VECTOR"],
        formats: ["svg", "png"],
        scale: 3,
      },
      fetchImpl,
    });

    expect(result.nestedAssetsDir).toBe(
      path.join(outputDir, "Settings.assets"),
    );
    expect(result.nestedAssetsManifestPath).toBe(
      path.join(outputDir, "Settings.frame.nested-assets.yaml"),
    );

    const manifest = parse(
      await readFile(result.nestedAssetsManifestPath, "utf8"),
    ) as typeof result.manifest;
    expect(manifest.criteria).toMatchObject({
      explicitNodeIds: ["208:44003"],
      includeRegex: "icon",
      nodeTypes: ["VECTOR"],
      formats: ["svg", "png"],
      scale: 3,
    });
    expect(manifest.exports.map((entry) => entry.nodeId)).toEqual([
      "208:44001",
      "208:44003",
    ]);
    expect(manifest.exports[0]?.reasons).toContain("selection:include-regex");
    expect(manifest.exports[1]?.reasons).toContain(
      "selection:explicit-node-id",
    );
    expect(manifest.exports[0]?.files).toEqual([
      expect.objectContaining({ format: "svg" }),
      expect.objectContaining({ format: "png", scale: 3 }),
    ]);
    expect(manifest.candidates.filter((entry) => entry.selected)).toHaveLength(
      2,
    );

    const svgPath = path.join(
      outputDir,
      manifest.exports[0]?.files[0]?.path ?? "",
    );
    await expect(readFile(svgPath, "utf8")).resolves.toBe(
      '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
    );
  });

  it("records skipped selected nodes when asset max is reached", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-nested-max-"));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/images/")) {
        return jsonResponse({
          images: { "208:44001": "https://cdn.example/208:44001.svg" },
        });
      }

      if (url.endsWith(".svg")) {
        return new Response(svgPayload(), { status: 200 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const result = await exportNestedAssets({
      token: "token",
      fileKey: "file-key",
      root: rootNode,
      baseName: "Settings",
      kind: "frame",
      outputDir,
      nestedAssets: {
        nodeIds: [],
        includeRegex: "icon|logo",
        maxAssets: 1,
        formats: ["svg"],
        scale: 2,
      },
      fetchImpl,
    });

    expect(result.manifest.exports.map((entry) => entry.nodeId)).toEqual([
      "208:44001",
    ]);
    expect(result.manifest.warnings).toEqual([
      {
        nodeId: "208:44003",
        message: "Skipped by --asset-max 1.",
      },
    ]);
  });

  it("rejects missing explicit nested node ids", async () => {
    await expect(
      exportNestedAssets({
        token: "token",
        fileKey: "file-key",
        root: rootNode,
        baseName: "Settings",
        kind: "frame",
        outputDir: "/tmp",
        nestedAssets: {
          nodeIds: ["missing"],
          formats: ["svg"],
          scale: 2,
        },
        fetchImpl: vi.fn() as typeof fetch,
      }),
    ).rejects.toThrow(FigmaInspectError);
  });

  it("rejects empty selection criteria", async () => {
    await expect(
      exportNestedAssets({
        token: "token",
        fileKey: "file-key",
        root: rootNode,
        baseName: "Settings",
        kind: "frame",
        outputDir: "/tmp",
        nestedAssets: {
          nodeIds: [],
          formats: ["svg"],
          scale: 2,
        },
        fetchImpl: vi.fn() as typeof fetch,
      }),
    ).rejects.toThrow(/requires --asset-node-id or --asset-include-regex/);
  });
});
