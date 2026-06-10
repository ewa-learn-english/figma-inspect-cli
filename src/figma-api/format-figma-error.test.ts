import { describe, expect, it } from "vitest";
import { formatFigmaError } from "./format-figma-error.js";

describe("formatFigmaError", () => {
  it("includes JSON message field in the error text", async () => {
    const response = new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      statusText: "Not Found",
      headers: { "content-type": "application/json" },
    });

    await expect(formatFigmaError(response)).resolves.toBe(
      "Figma API request failed (404 Not Found): Not found",
    );
  });

  it("falls back to err field when message is absent", async () => {
    const response = new Response(JSON.stringify({ err: "Invalid token" }), {
      status: 403,
      statusText: "Forbidden",
      headers: { "content-type": "application/json" },
    });

    await expect(formatFigmaError(response)).resolves.toBe(
      "Figma API request failed (403 Forbidden): Invalid token",
    );
  });

  it("uses plain text bodies for non-JSON responses", async () => {
    const response = new Response("upstream failure", {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "content-type": "text/plain" },
    });

    await expect(formatFigmaError(response)).resolves.toBe(
      "Figma API request failed (502 Bad Gateway): upstream failure",
    );
  });

  it("omits body detail when the response has no readable payload", async () => {
    const response = new Response("", {
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(formatFigmaError(response)).resolves.toBe(
      "Figma API request failed (500 Internal Server Error)",
    );
  });
});
