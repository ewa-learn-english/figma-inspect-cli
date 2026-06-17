import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaInspectError } from "../errors.js";
import { exportNodePreview } from "./export-node-preview.js";

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
    '<svg width="390" height="844" viewBox="0 0 390 844"><rect width="390" height="844"/></svg>',
  );
}

describe("exportNodePreview", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports a PNG preview at the requested scale", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-preview-png-"));
    const bytes = pngPayload();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/images/")) {
        const parsed = new URL(url);
        expect(parsed.searchParams.get("format")).toBe("png");
        expect(parsed.searchParams.get("scale")).toBe("2");
        return jsonResponse({
          images: { "208:43935": "https://cdn.example/preview.png" },
        });
      }

      if (url === "https://cdn.example/preview.png") {
        return new Response(bytes, { status: 200 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const result = await exportNodePreview({
      token: "token",
      fileKey: "file-key",
      nodeId: "208:43935",
      baseName: "Settings",
      kind: "frame",
      outputDir,
      preview: { format: "png", scale: 2 },
      fetchImpl,
    });

    expect(result.previewPath).toBe(
      path.join(outputDir, "Settings.frame.preview.png"),
    );
    await expect(readFile(result.previewPath)).resolves.toEqual(
      Buffer.from(bytes),
    );
  });

  it("exports a normalized SVG preview", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-preview-svg-"));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/images/")) {
        const parsed = new URL(url);
        expect(parsed.searchParams.get("format")).toBe("svg");
        expect(parsed.searchParams.has("scale")).toBe(false);
        return jsonResponse({
          images: { "208:43935": "https://cdn.example/preview.svg" },
        });
      }

      if (url === "https://cdn.example/preview.svg") {
        return new Response(svgPayload(), { status: 200 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const result = await exportNodePreview({
      token: "token",
      fileKey: "file-key",
      nodeId: "208:43935",
      baseName: "Settings",
      kind: "frame",
      outputDir,
      preview: { format: "svg" },
      fetchImpl,
    });

    await expect(readFile(result.previewPath, "utf8")).resolves.toBe(
      '<svg viewBox="0 0 390 844"><rect width="390" height="844"/></svg>',
    );
  });

  it("rejects invalid PNG bytes", async () => {
    const outputDir = await mkdtemp(
      path.join(tmpdir(), "figma-preview-invalid-"),
    );
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/images/")) {
        return jsonResponse({
          images: { "208:43935": "https://cdn.example/preview.png" },
        });
      }

      if (url === "https://cdn.example/preview.png") {
        return new Response(new TextEncoder().encode("not png"), {
          status: 200,
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    await expect(
      exportNodePreview({
        token: "token",
        fileKey: "file-key",
        nodeId: "208:43935",
        baseName: "Settings",
        kind: "frame",
        outputDir,
        preview: { format: "png", scale: 2 },
        fetchImpl,
      }),
    ).rejects.toThrow(FigmaInspectError);
  });
});
