import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFigmaResponse } from "./fetch-with-retry.js";

describe("fetchFigmaResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns successful responses without retrying", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const responsePromise = fetchFigmaResponse(
      "https://api.figma.com/v1/test",
      "token",
      fetchImpl,
    );

    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

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

    const responsePromise = fetchFigmaResponse(
      "https://api.figma.com/v1/test",
      "token",
      fetchImpl,
    );

    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers?.["X-FIGMA-TOKEN"]).toBe(
      "token",
    );
  });

  it("respects x-ratelimit-reset before retrying", async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "x-ratelimit-reset": String(Math.floor(now / 1000) + 2) },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const responsePromise = fetchFigmaResponse(
      "https://api.figma.com/v1/test",
      "token",
      fetchImpl,
    );

    await vi.advanceTimersByTimeAsync(1249);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
