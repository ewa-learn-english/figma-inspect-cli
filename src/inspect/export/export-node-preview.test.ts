import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RENDERED_PNG_BYTES,
  RENDERED_RGBA_BYTES,
} from "../../../test/fixtures/rendered-image.js";
import { FigmaInspectError } from "../errors.js";
import { exportNodePreview } from "./export-node-preview.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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

  it("downloads PNG at the requested scale and writes a lossless WebP preview", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-preview-png-"));
    const bytes = RENDERED_PNG_BYTES;
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
      preview: { format: "webp", scale: 2 },
      fetchImpl,
    });

    expect(result.previewPath).toBe(
      path.join(outputDir, "Settings.frame.preview.webp"),
    );
    const output = sharp(await readFile(result.previewPath));
    await expect(output.metadata()).resolves.toMatchObject({ format: "webp" });
    await expect(output.raw().toBuffer()).resolves.toEqual(RENDERED_RGBA_BYTES);
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
        preview: { format: "webp", scale: 2 },
        fetchImpl,
      }),
    ).rejects.toThrow(FigmaInspectError);
  });
});
