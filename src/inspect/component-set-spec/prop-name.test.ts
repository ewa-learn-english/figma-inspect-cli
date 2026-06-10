import { describe, expect, it } from "vitest";
import { normalizePropName, rawPropKey, resolvePropName } from "./prop-name.js";

describe("rawPropKey", () => {
  it("strips Figma instance suffix after #", () => {
    expect(rawPropKey("icon#12345")).toBe("icon");
  });
});

describe("normalizePropName", () => {
  it("camelCases spaced labels", () => {
    expect(normalizePropName("Field name")).toBe("fieldName");
  });

  it("returns value for empty input", () => {
    expect(normalizePropName("---")).toBe("value");
  });
});

describe("resolvePropName", () => {
  it("keeps variant axis names as-is", () => {
    expect(resolvePropName("State", "variant")).toBe("State");
  });

  it("normalizes instance prop keys", () => {
    expect(resolvePropName("Search Icon", "instance")).toBe("searchIcon");
  });
});
