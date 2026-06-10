import { describe, expect, it } from "vitest";
import { extractVersionMetadata } from "./extract-metadata.js";

describe("extractVersionMetadata", () => {
  it("extracts version and lastModified from file payloads", () => {
    expect(
      extractVersionMetadata({
        version: 123,
        lastModified: "2024-01-01T00:00:00Z",
      }),
    ).toEqual({
      version: "123",
      lastModified: "2024-01-01T00:00:00Z",
    });
  });

  it("returns empty metadata for non-object payloads", () => {
    expect(extractVersionMetadata(null)).toEqual({});
    expect(extractVersionMetadata("nope")).toEqual({});
  });

  it("ignores non-string lastModified values", () => {
    expect(
      extractVersionMetadata({
        version: "1",
        lastModified: 123,
      }),
    ).toEqual({ version: "1" });
  });
});
