import { describe, expect, it } from "vitest";
import { FigmaInspectError } from "./errors.js";
import { parseFigmaNodeUrl } from "./figma-node-url.js";

describe("parseFigmaNodeUrl", () => {
  it("parses design URLs and normalizes node ids", () => {
    expect(
      parseFigmaNodeUrl(
        "https://www.figma.com/design/hnD2ovk2BlW2TObGwLlMhA/Settings?node-id=213-695&m=dev",
      ),
    ).toEqual({
      fileKey: "hnD2ovk2BlW2TObGwLlMhA",
      nodeId: "213:695",
    });
  });

  it("parses file URLs with encoded colon node ids", () => {
    expect(
      parseFigmaNodeUrl(
        "https://figma.com/file/fileKey/Name?node-id=208%3A43935",
      ),
    ).toEqual({
      fileKey: "fileKey",
      nodeId: "208:43935",
    });
  });

  it("rejects unsupported URLs", () => {
    expect(() => parseFigmaNodeUrl("not a url")).toThrow(FigmaInspectError);
    expect(() =>
      parseFigmaNodeUrl("https://example.com/design/file/Name?node-id=1-2"),
    ).toThrow(/Invalid Figma URL host/);
    expect(() =>
      parseFigmaNodeUrl("https://figma.com/board/file/Name?node-id=1-2"),
    ).toThrow(/must use \/design/);
    expect(() =>
      parseFigmaNodeUrl("https://figma.com/design/file/Name"),
    ).toThrow(/missing node-id/);
  });
});
