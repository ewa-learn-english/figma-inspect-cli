import { describe, expect, it } from "vitest";
import {
  fingerprintContracts,
  fingerprintTree,
  variantAssetSlug,
} from "./fingerprint.js";

describe("fingerprintTree", () => {
  it("is stable for the same document node", () => {
    const tree = { id: "1:1", type: "COMPONENT_SET", name: "Cell" };
    expect(fingerprintTree(tree)).toBe(fingerprintTree(tree));
  });

  it("changes when tree content changes", () => {
    const left = { id: "1:1", type: "COMPONENT_SET", name: "Cell" };
    const right = { id: "1:1", type: "COMPONENT_SET", name: "Button" };
    expect(fingerprintTree(left)).not.toBe(fingerprintTree(right));
  });
});

describe("fingerprintContracts", () => {
  it("includes meta in the contracts fingerprint", () => {
    const visuals = { a: 1 };
    const geometry = { b: 2 };
    const dsl = "component X\n";
    const withMeta = fingerprintContracts(visuals, geometry, { version: 1 }, dsl);
    const withoutMeta = fingerprintContracts(visuals, geometry, {}, dsl);
    expect(withMeta).not.toBe(withoutMeta);
  });
});

describe("variantAssetSlug", () => {
  it("orders axes with Size last and lowercases values", () => {
    const slug = variantAssetSlug(
      { Size: "XL", Status: "Active" },
      { Status: ["Active", "Missed"], Size: ["M", "XL"] },
    );
    expect(slug).toBe("active-xl");
  });
});
