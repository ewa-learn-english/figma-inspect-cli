import { describe, expect, it } from "vitest";
import { FigmaInspectError } from "../errors.js";
import {
  assertComponentSetSupportsAssetExport,
  assertExportedSvgBytes,
} from "./assert-asset-exportable.js";

const variantOnlyComponentSet: Record<string, unknown> = {
  componentPropertyDefinitions: {
    "Status#1:0": {
      type: "VARIANT",
      defaultValue: "Active",
      variantOptions: ["Active", "Missed"],
    },
  },
  children: [
    {
      type: "COMPONENT",
      name: "Status=Active",
      children: [{ type: "RECTANGLE" }],
    },
  ],
};

describe("assertComponentSetSupportsAssetExport", () => {
  it("accepts component sets with variant props and vector-only trees", () => {
    expect(() =>
      assertComponentSetSupportsAssetExport(variantOnlyComponentSet),
    ).not.toThrow();
  });

  it("rejects non-variant component properties", () => {
    const componentSet: Record<string, unknown> = {
      ...variantOnlyComponentSet,
      componentPropertyDefinitions: {
        ...variantOnlyComponentSet.componentPropertyDefinitions,
        "showName#2:0": {
          type: "BOOLEAN",
          defaultValue: true,
        },
      },
    };

    expect(() => assertComponentSetSupportsAssetExport(componentSet)).toThrow(
      FigmaInspectError,
    );
    expect(() => assertComponentSetSupportsAssetExport(componentSet)).toThrow(
      /showName \(boolean\)/,
    );
  });

  it("rejects variant trees that contain text nodes", () => {
    const componentSet: Record<string, unknown> = {
      ...variantOnlyComponentSet,
      children: [
        {
          type: "COMPONENT",
          name: "Status=Active",
          children: [{ type: "TEXT", characters: "Label" }],
        },
      ],
    };

    expect(() => assertComponentSetSupportsAssetExport(componentSet)).toThrow(
      /variant trees contain TEXT nodes/,
    );
  });
});

describe("assertExportedSvgBytes", () => {
  it("accepts svg payloads", () => {
    const bytes = new TextEncoder().encode('<svg viewBox="0 0 1 1"></svg>');
    expect(() => assertExportedSvgBytes(bytes, "Status=Active")).not.toThrow();
  });

  it("rejects non-svg payloads", () => {
    const bytes = new TextEncoder().encode("not svg");
    expect(() => assertExportedSvgBytes(bytes, "Status=Active")).toThrow(
      /Exported asset for Status=Active is not SVG/,
    );
  });
});
