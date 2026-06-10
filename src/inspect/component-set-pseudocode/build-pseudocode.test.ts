import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readComponentContractArtifacts } from "../contract/contract-schema.js";
import { buildAssetBackedLayoutBundle } from "./asset-backed-contract.js";
import { hasAssetContractMap } from "./assets-contract.js";
import { buildComponentSetPseudocodeFromRaw } from "./build-pseudocode.js";

const tmpDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../tmp",
);

function makeProfileStreakVariant(
  status: string,
  size: string,
  dimension: number,
) {
  return {
    type: "COMPONENT",
    id: `${status}-${size}`,
    name: `Status=${status}, Size=${size}`,
    absoluteBoundingBox: {
      x: 0,
      y: 0,
      width: dimension,
      height: dimension,
    },
    layoutMode: "NONE",
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    clipsContent: true,
    constraints: { horizontal: "MIN", vertical: "MIN" },
  };
}

describe("hasAssetContractMap", () => {
  it("accepts non-empty asset maps only", () => {
    expect(hasAssetContractMap(undefined)).toBe(false);
    expect(hasAssetContractMap({})).toBe(false);
    expect(
      hasAssetContractMap({
        M: { Active: { format: "svg", path: "a.svg" } },
      }),
    ).toBe(true);
  });
});

describe("buildAssetBackedLayoutBundle", () => {
  it("nests root geometry under variant axes", () => {
    const layout = buildAssetBackedLayoutBundle({
      name: "ProfileStreakIcon",
      props: {},
      baseVariant: { Size: "M", Status: "Missed" },
      variantAxes: {
        Size: ["M", "XL"],
        Status: ["Active", "Missed"],
      },
      variants: [
        {
          when: { Size: "M", Status: "Active" },
          layout: {
            type: "frame",
            layout: { width: 48, height: 48, clip: true },
          },
        },
        {
          when: { Size: "XL", Status: "Missed" },
          layout: {
            type: "frame",
            layout: { width: 160, height: 160, clip: true },
          },
        },
      ],
    });

    expect(layout).toEqual({
      M: {
        Active: {
          root: {
            width: 48,
            height: 48,
            clip: true,
          },
        },
      },
      XL: {
        Missed: {
          root: {
            width: 160,
            height: 160,
            clip: true,
          },
        },
      },
    });
  });
});

describe("buildComponentSetPseudocodeFromRaw", () => {
  it("matches ProfileStreakIcon tmp contract shape for asset-backed export", async () => {
    const componentSet = {
      id: "5708:145",
      type: "COMPONENT_SET",
      name: "ProfileStreakIcon",
      componentPropertyDefinitions: {
        Status: {
          type: "VARIANT",
          defaultValue: "Missed",
          variantOptions: ["Active", "Missed", "Loading"],
        },
        Size: {
          type: "VARIANT",
          defaultValue: "M",
          variantOptions: ["M", "XL"],
        },
      },
      children: [
        makeProfileStreakVariant("Active", "M", 48),
        makeProfileStreakVariant("Missed", "M", 48),
        makeProfileStreakVariant("Loading", "M", 48),
        makeProfileStreakVariant("Active", "XL", 160),
        makeProfileStreakVariant("Missed", "XL", 160),
        makeProfileStreakVariant("Loading", "XL", 160),
      ],
    };

    const assets = {
      M: {
        Active: {
          format: "svg" as const,
          path: "ProfileStreakIcon.assets/active-m.svg",
        },
        Loading: {
          format: "svg" as const,
          path: "ProfileStreakIcon.assets/loading-m.svg",
        },
        Missed: {
          format: "svg" as const,
          path: "ProfileStreakIcon.assets/missed-m.svg",
        },
      },
      XL: {
        Active: {
          format: "svg" as const,
          path: "ProfileStreakIcon.assets/active-xl.svg",
        },
        Loading: {
          format: "svg" as const,
          path: "ProfileStreakIcon.assets/loading-xl.svg",
        },
        Missed: {
          format: "svg" as const,
          path: "ProfileStreakIcon.assets/missed-xl.svg",
        },
      },
    };

    const result = await buildComponentSetPseudocodeFromRaw(componentSet, {
      assetBacked: true,
      assets,
    });

    const expected = await readComponentContractArtifacts(
      tmpDir,
      "ProfileStreakIcon",
      "yaml",
    );

    expect(result.componentName).toBe("ProfileStreakIcon");
    expect(result.meta.props).toEqual(expected.meta.props);
    expect(result.meta.assets).toEqual(expected.meta.assets);
    expect(result.visuals).toEqual(expected.visuals);
    expect(result.geometry).toEqual(expected.geometry);
    expect(result.structureDsl).toBe(expected.structureDsl);
  });

  it("matches TextInput tmp structure DSL sections", async () => {
    const [expectedDsl, expectedMeta] = await Promise.all([
      readFile(path.join(tmpDir, "TextInput.contract.structure.dsl"), "utf8"),
      readComponentContractArtifacts(tmpDir, "TextInput", "yaml").then(
        (artifacts) => artifacts.meta,
      ),
    ]);

    expect(expectedMeta.props?.State?.options).toEqual([
      "Empty",
      "Filled",
      "Disabled",
    ]);
    expect(expectedDsl).toContain("dispatch {");
    expect(expectedDsl).toContain('Writing = "Default" => writingDefault');
    expect(expectedDsl).toContain("resolve {");
    expect(expectedDsl).toContain("scheme = visuals[Active][State][Writing]");
  });
});
