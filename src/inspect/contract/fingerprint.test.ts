import { describe, expect, it } from "vitest";
import { VariableRegistry } from "../component-set-spec/variable-registry.js";
import {
  fingerprintContractSurface,
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
    const withMeta = fingerprintContracts(
      visuals,
      geometry,
      { version: 1 },
      dsl,
    );
    const withoutMeta = fingerprintContracts(visuals, geometry, {}, dsl);
    expect(withMeta).not.toBe(withoutMeta);
  });
});

describe("fingerprintContractSurface", () => {
  const baseTree = {
    id: "1:1",
    type: "FRAME",
    name: "Settings",
    isExposedInstance: false,
    absoluteBoundingBox: { x: 10, y: 20, width: 390, height: 844 },
    layoutMode: "VERTICAL",
    paddingTop: 16,
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
    children: [
      {
        id: "1:2",
        type: "TEXT",
        name: "Title",
        isExposedInstance: false,
        characters: "Settings",
        style: { fontFamily: "Inter", fontSize: 24 },
      },
      {
        id: "1:3",
        type: "RECTANGLE",
        name: "Card",
        isExposedInstance: false,
        absoluteBoundingBox: { x: 10, y: 80, width: 358, height: 64 },
      },
    ],
  };

  it("ignores timestamps and volatile metadata", () => {
    const withMetadataDrift = {
      ...baseTree,
      updated_at: "2099-01-01T00:00:00.000Z",
      lastModified: "2099-01-01T00:00:00.000Z",
      pluginData: { generatedAt: "now" },
      children: baseTree.children.map((child) => ({
        ...child,
        updatedAt: "2099-01-01T00:00:00.000Z",
      })),
    };

    expect(fingerprintContractSurface(withMetadataDrift)).toBe(
      fingerprintContractSurface(baseTree),
    );
  });

  it("ignores absolute canvas position when dimensions stay the same", () => {
    const movedOnCanvas = {
      ...baseTree,
      absoluteBoundingBox: { x: 900, y: 1200, width: 390, height: 844 },
      children: baseTree.children.map((child) => ({
        ...child,
        ...(child.absoluteBoundingBox
          ? { absoluteBoundingBox: { x: 700, y: 800, width: 358, height: 64 } }
          : {}),
      })),
    };

    expect(fingerprintContractSurface(movedOnCanvas)).toBe(
      fingerprintContractSurface(baseTree),
    );
  });

  it("changes for layout, visual, text, and child-order changes", () => {
    const paddingChanged = { ...baseTree, paddingTop: 24 };
    const fillChanged = {
      ...baseTree,
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
    };
    const textChanged = {
      ...baseTree,
      children: [
        { ...baseTree.children[0], characters: "Preferences" },
        baseTree.children[1],
      ],
    };
    const childOrderChanged = {
      ...baseTree,
      children: [...baseTree.children].reverse(),
    };

    const base = fingerprintContractSurface(baseTree);
    expect(fingerprintContractSurface(paddingChanged)).not.toBe(base);
    expect(fingerprintContractSurface(fillChanged)).not.toBe(base);
    expect(fingerprintContractSurface(textChanged)).not.toBe(base);
    expect(fingerprintContractSurface(childOrderChanged)).not.toBe(base);
  });

  it("changes when component property references change", () => {
    const withReference = {
      ...baseTree,
      children: [
        {
          ...baseTree.children[0],
          componentPropertyReferences: { characters: "label-prop-id" },
        },
        baseTree.children[1],
      ],
    };
    const withOtherReference = {
      ...withReference,
      children: [
        {
          ...withReference.children[0],
          componentPropertyReferences: { characters: "title-prop-id" },
        },
        withReference.children[1],
      ],
    };

    expect(fingerprintContractSurface(withOtherReference)).not.toBe(
      fingerprintContractSurface(withReference),
    );
  });

  it("uses resolved token names for bound variables", () => {
    const registry = VariableRegistry.fromExport({
      variables: {
        color: {
          id: "VariableID:color-id",
          key: "color-key",
          name: "color.bg.surface",
        },
      },
    });
    const tree = {
      ...baseTree,
      fills: [
        {
          type: "SOLID",
          color: { r: 1, g: 1, b: 1, a: 1 },
          boundVariables: {
            color: { type: "VARIABLE_ALIAS", id: "VariableID:color-id" },
          },
        },
      ],
    };
    const sameTokenViaVariableKey = {
      ...tree,
      fills: [
        {
          type: "SOLID",
          color: { r: 1, g: 1, b: 1, a: 1 },
          boundVariables: {
            color: { type: "VARIABLE_ALIAS", id: "color-key/123" },
          },
        },
      ],
    };

    expect(fingerprintContractSurface(tree, registry)).toBe(
      fingerprintContractSurface(sameTokenViaVariableKey, registry),
    );
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
