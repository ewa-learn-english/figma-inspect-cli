import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaApiError } from "./figma-api-error.js";
import { figmaRequest } from "./figma-request.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("figmaRequest", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns parsed JSON for successful responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await expect(
      figmaRequest("https://api.figma.com/v1/test", "token", fetchImpl),
    ).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledWith("https://api.figma.com/v1/test", {
      headers: { "X-FIGMA-TOKEN": "token" },
    });
  });

  it("throws FigmaApiError with formatted message for failed responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        statusText: "Forbidden",
        headers: { "content-type": "application/json" },
      }),
    );

    const error = await figmaRequest(
      "https://api.figma.com/v1/test",
      "token",
      fetchImpl,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FigmaApiError);
    expect((error as Error).message).toBe(
      "Figma API request failed (403 Forbidden): Forbidden",
    );
  });
});
