import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CachedFigmaRequest } from "./cached-request.js";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("CachedFigmaRequest", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves cached responses without repeating network requests", async () => {
    const token = `cache-test-${randomUUID()}`;
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          version: "42",
          lastModified: "2024-01-01T00:00:00Z",
          name: "Document",
        },
        200,
        { etag: "etag-1" },
      ),
    );
    const client = new CachedFigmaRequest(token);
    const url = "https://api.figma.com/v1/files/file-key/nodes?ids=1%3A2";

    await expect(client.request(url, fetchImpl)).resolves.toEqual({
      version: "42",
      lastModified: "2024-01-01T00:00:00Z",
      name: "Document",
    });
    await expect(client.request(url, fetchImpl)).resolves.toEqual({
      version: "42",
      lastModified: "2024-01-01T00:00:00Z",
      name: "Document",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
