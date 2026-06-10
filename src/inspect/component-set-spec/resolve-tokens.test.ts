import { describe, expect, it } from "vitest";
import { resolveSpecTokens } from "./resolve-tokens.js";
import type { ComponentSetSpec } from "./types.js";
import { VariableRegistry } from "./variable-registry.js";

describe("resolveSpecTokens", () => {
  it("replaces bound variable ids with token names in variant trees", () => {
    const registry = VariableRegistry.fromExport({
      variables: {
        spacing: {
          id: "VariableID:spacing-md",
          key: "spacing-md",
          name: "spacing/md",
        },
      },
    });

    const spec: ComponentSetSpec = {
      name: "Chip",
      props: {},
      baseVariant: {},
      variantAxes: {},
      variants: [
        {
          when: { State: "Default" },
          layout: {
            type: "frame",
            layout: {
              padding: {
                top: { value: 8, variable: "spacing-md" },
              },
            },
          },
        },
      ],
    };

    expect(
      resolveSpecTokens(spec, registry).variants[0]?.layout.layout?.padding
        ?.top,
    ).toEqual({
      value: 8,
      token: "spacing/md",
    });
  });

  it("leaves unresolved variable ids unchanged", () => {
    const registry = VariableRegistry.fromExport({ variables: {} });
    const padding = { top: { value: 8, variable: "missing-id" } };
    const spec: ComponentSetSpec = {
      name: "Chip",
      props: {},
      baseVariant: {},
      variantAxes: {},
      variants: [
        {
          when: { State: "Default" },
          layout: { type: "frame", layout: { padding } },
        },
      ],
    };

    expect(
      resolveSpecTokens(spec, registry).variants[0]?.layout.layout?.padding,
    ).toEqual(padding);
  });
});
