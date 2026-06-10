import { describe, expect, it } from "vitest";
import {
  buildFileProbeUrl,
  extractFileKey,
  hashValue,
  normalizeRequestUrl,
} from "./url.js";

describe("normalizeRequestUrl", () => {
  it("sorts query params and strips hash fragments", () => {
    const normalized = normalizeRequestUrl(
      "https://api.figma.com/v1/files/abc/nodes?ids=1%3A2&format=svg#ignored",
    );

    expect(normalized).toBe(
      "https://api.figma.com/v1/files/abc/nodes?format=svg&ids=1%3A2",
    );
  });
});

describe("extractFileKey", () => {
  it("reads file keys from file and node endpoints", () => {
    expect(
      extractFileKey(
        "https://api.figma.com/v1/files/my-file-key/nodes?ids=1%3A2",
      ),
    ).toBe("my-file-key");
    expect(extractFileKey("https://api.figma.com/v1/files/my-file-key")).toBe(
      "my-file-key",
    );
    expect(extractFileKey("https://api.figma.com/v1/teams/123/projects")).toBe(
      undefined,
    );
  });
});

describe("buildFileProbeUrl", () => {
  it("builds a shallow file probe URL", () => {
    expect(buildFileProbeUrl("file/key")).toBe(
      "https://api.figma.com/v1/files/file%2Fkey?depth=1",
    );
  });
});

describe("hashValue", () => {
  it("returns stable sha256 hex digests", () => {
    expect(hashValue("same-input")).toBe(hashValue("same-input"));
    expect(hashValue("same-input")).not.toBe(hashValue("other-input"));
  });
});
