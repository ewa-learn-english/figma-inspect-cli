import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaApiError } from "./figma-api-error.js";
import { downloadRenderedImage, getFileImageUrls } from "./get-file-images.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getFileImageUrls", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an empty map without calling the API", async () => {
    const fetchImpl = vi.fn();

    await expect(
      getFileImageUrls({
        token: "token",
        fileKey: "file-key",
        nodeIds: [],
        format: "svg",
        fetchImpl,
      }),
    ).resolves.toEqual({});

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("deduplicates node ids and requests image URLs in batches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        images: {
          "1:1": "https://cdn.example/1.png",
          "1:2": "https://cdn.example/2.png",
        },
      }),
    );

    await expect(
      getFileImageUrls({
        token: "token",
        fileKey: "file-key",
        nodeIds: ["1:1", "1:1", "1:2"],
        format: "svg",
        fetchImpl,
      }),
    ).resolves.toEqual({
      "1:1": "https://cdn.example/1.png",
      "1:2": "https://cdn.example/2.png",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/images/file-key?");
    expect(requestedUrl).toContain("format=svg");
    expect(requestedUrl).toContain("ids=1%3A1%2C1%3A2");
  });

  it("throws when the API omits a requested node URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        images: { "1:1": "https://cdn.example/1.png" },
      }),
    );

    await expect(
      getFileImageUrls({
        token: "token",
        fileKey: "file-key",
        nodeIds: ["1:1", "1:2"],
        format: "svg",
        fetchImpl,
      }),
    ).rejects.toThrow(FigmaApiError);
  });
});

describe("downloadRenderedImage", () => {
  it("returns response bytes for successful downloads", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(bytes, { status: 200 }));

    await expect(
      downloadRenderedImage("https://cdn.example/asset.png", fetchImpl),
    ).resolves.toEqual(bytes);
  });

  it("throws FigmaApiError when the download fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response("missing", { status: 404, statusText: "Not Found" }),
      );

    await expect(
      downloadRenderedImage("https://cdn.example/missing.png", fetchImpl),
    ).rejects.toThrow("Rendered asset download failed: 404 Not Found.");
  });
});
