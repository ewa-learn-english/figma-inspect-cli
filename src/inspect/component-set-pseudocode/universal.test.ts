import { describe, expect, it } from "vitest";
import type { SlimNode } from "../component-set-spec/types.js";
import type { PseudocodeModel } from "./types.js";
import {
  buildUniversalContracts,
  extractGeometryFromNode,
  extractVisualsFromNode,
  mergeNestedContracts,
  setNestedBundle,
} from "./universal.js";

describe("extractVisualsFromNode", () => {
  it("collects style and text tokens", () => {
    const node: SlimNode = {
      type: "text",
      style: {
        background: { token: "surface/default" },
        border: { token: "border/subtle" },
        radius: { token: "radius/md" },
        opacity: 0.5,
      },
      text: {
        content: "Hello",
        color: { token: "text/primary" },
        size: { token: "type/body" },
      },
    };

    expect(extractVisualsFromNode(node)).toEqual({
      background: "surface/default",
      border: "border/subtle",
      radius: "radius/md",
      opacity: 0.5,
      color: "text/primary",
      size: "type/body",
    });
  });
});

describe("extractGeometryFromNode", () => {
  it("collects layout sizing and padding", () => {
    const node: SlimNode = {
      type: "frame",
      layout: {
        mode: "row",
        gap: { token: "space/sm" },
        width: { token: "size/full" },
        height: 48,
        padding: {
          top: { token: "space/xs" },
          right: 8,
          bottom: { token: "space/xs" },
          left: 8,
        },
        align: { main: "CENTER", cross: "CENTER" },
        clip: true,
      },
    };

    expect(extractGeometryFromNode(node)).toEqual({
      layoutMode: "row",
      gap: "space/sm",
      width: "size/full",
      height: 48,
      paddingTop: "space/xs",
      paddingRight: 8,
      paddingBottom: "space/xs",
      paddingLeft: 8,
      alignMain: "CENTER",
      alignCross: "CENTER",
      clip: true,
    });
  });
});

describe("mergeNestedContracts", () => {
  it("merges leaf bundles at the deepest axis level", () => {
    const baseline = {
      M: {
        Active: { root: { width: 48 } },
      },
    };
    const overrides = {
      M: {
        Active: { root: { height: 48 }, badge: { opacity: 0.8 } },
      },
    };

    expect(mergeNestedContracts(baseline, overrides, 0, 2)).toEqual({
      M: {
        Active: {
          root: { width: 48, height: 48 },
          badge: { opacity: 0.8 },
        },
      },
    });
  });
});

describe("setNestedBundle", () => {
  it("writes variant-specific node bundles under axis keys", () => {
    const root: Record<string, unknown> = {};
    setNestedBundle(
      root,
      ["Size", "Status"],
      { Size: "M", Status: "Active" },
      { root: { width: 48, height: 48 } },
    );

    expect(root).toEqual({
      M: {
        Active: {
          root: { width: 48, height: 48 },
        },
      },
    });
  });
});

describe("buildUniversalContracts", () => {
  it("materializes per-variant overrides from template rows", () => {
    const model: PseudocodeModel = {
      name: "Badge",
      props: {
        State: { type: "variant", default: "Default", options: ["Default"] },
      },
      baseVariant: { State: "Default" },
      variantAxes: { State: ["Default", "Hover"] },
      definitions: {},
      definitionTemplates: [],
      templates: [
        {
          name: "allVariants",
          variables: ["labelColor"],
          layout: {
            type: "text",
            name: "Label",
            text: { content: { $var: "labelColor" } },
          },
        },
      ],
      variantGroups: [
        {
          template: "allVariants",
          axes: ["State"],
          values: ["labelColor"],
          rows: [
            ["Default", "text/primary"],
            ["Hover", "text/hover"],
          ],
        },
      ],
      stats: {
        variants: 2,
        definitions: 0,
        definitionTemplates: 0,
        templates: 1,
        variantGroups: 1,
      },
    };

    const { visuals } = buildUniversalContracts(model);
    expect(visuals).toEqual({
      Default: { label: { labelColor: "text/primary" } },
      Hover: { label: { labelColor: "text/hover" } },
    });
  });
});
