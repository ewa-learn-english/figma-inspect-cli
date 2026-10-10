import { describe, expect, it } from "vitest";
import {
  FigmaApiError,
  FigmaResponseTooLargeError,
  FigmaUnreadableFileError,
} from "./figma-api-error.js";
import { readFigmaResponse } from "./read-figma-response.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 400 ? "Bad Request" : "OK",
    headers: { "content-type": "application/json" },
  });
}

describe("readFigmaResponse", () => {
  it("parses JSON bodies within the string limit", async () => {
    await expect(
      readFigmaResponse(jsonResponse({ name: "File" }), 100),
    ).resolves.toEqual({ name: "File" });
  });

  it("stops reading bodies that exceed the string limit", async () => {
    const error = await readFigmaResponse(
      jsonResponse({ name: "x".repeat(200) }),
      100,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FigmaResponseTooLargeError);
    expect((error as Error).message).toContain("request a smaller node");
  });

  it("classifies Figma's request size refusal", async () => {
    const error = await readFigmaResponse(
      jsonResponse(
        {
          status: 400,
          err: "Request too large. If applicable, filter by query params.",
        },
        400,
      ),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FigmaResponseTooLargeError);
    expect((error as Error).message).toBe(
      "Figma API request failed (400 Bad Request): Request too large. If applicable, filter by query params.",
    );
  });

  it("classifies an overlong request URL as too large", async () => {
    const response = new Response("", {
      status: 414,
      statusText: "URI Too Long",
    });

    await expect(readFigmaResponse(response)).rejects.toBeInstanceOf(
      FigmaResponseTooLargeError,
    );
  });

  it("classifies files the file endpoints cannot read", async () => {
    for (const [status, err] of [
      [400, "File type not supported by this endpoint"],
      [403, "File not exportable"],
    ] as const) {
      await expect(
        readFigmaResponse(jsonResponse({ status, err }, status)),
      ).rejects.toBeInstanceOf(FigmaUnreadableFileError);
    }
    await expect(
      readFigmaResponse(
        jsonResponse({ status: 403, err: "Invalid token" }, 403),
      ),
    ).rejects.not.toBeInstanceOf(FigmaUnreadableFileError);
  });

  it("keeps other failures as Figma API errors", async () => {
    const error = await readFigmaResponse(
      jsonResponse({ status: 400, err: "Invalid node id" }, 400),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FigmaApiError);
    expect(error).not.toBeInstanceOf(FigmaResponseTooLargeError);
  });
});
