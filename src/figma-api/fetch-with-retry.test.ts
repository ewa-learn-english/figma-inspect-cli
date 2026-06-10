import { describe, expect, it, vi } from "vitest";
import { fetchFigmaResponse } from "./fetch-with-retry.js";

describe("fetchFigmaResponse", () => {
  it("retries on 429 then returns success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await fetchFigmaResponse(
      "https://api.figma.com/v1/test",
      "token",
      fetchImpl,
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers?.["X-FIGMA-TOKEN"]).toBe(
      "token",
    );
  });
});
