import { describe, expect, it } from "vitest";
import type { ComponentSetSpec } from "../component-set-spec/types.js";
import { buildPseudocodeModelFromSpec } from "./infer.js";

const sharedFrame = {
  type: "frame" as const,
  name: "Shared container",
  layout: {
    mode: "row" as const,
    gap: 8,
    padding: { top: 12, right: 16, bottom: 12, left: 16 },
    width: 320,
    height: 48,
    align: { main: "CENTER", cross: "CENTER" },
  },
  style: {
    background: { token: "surface/default" },
    border: { token: "border/subtle", width: 1 },
    radius: { token: "radius/md" },
  },
  children: [
    {
      type: "text" as const,
      name: "Label",
      text: {
        content: "Placeholder",
        style: { color: { token: "text/secondary" } },
      },
    },
  ],
};

describe("buildPseudocodeModelFromSpec", () => {
  it("deduplicates repeated subtrees into definitions", () => {
    const spec: ComponentSetSpec = {
      name: "Input",
      props: {
        State: {
          type: "variant",
          default: "Default",
          options: ["Default", "Hover"],
        },
      },
      baseVariant: { State: "Default" },
      variantAxes: { State: ["Default", "Hover"] },
      variants: [
        { when: { State: "Default" }, layout: sharedFrame },
        { when: { State: "Hover" }, layout: structuredClone(sharedFrame) },
      ],
    };

    const model = buildPseudocodeModelFromSpec(spec);
    expect(model.stats.definitions).toBeGreaterThan(0);
    expect(Object.keys(model.definitions).length).toBeGreaterThan(0);
    expect(model.stats.variants).toBe(2);
  });

  it("builds variant templates and groups for multi-axis sets", () => {
    const spec: ComponentSetSpec = {
      name: "Toggle",
      props: {
        Size: { type: "variant", default: "M", options: ["M", "L"] },
        On: { type: "variant", default: "Off", options: ["Off", "On"] },
      },
      baseVariant: { Size: "M", On: "Off" },
      variantAxes: {
        Size: ["M", "L"],
        On: ["Off", "On"],
      },
      variants: [
        {
          when: { Size: "M", On: "Off" },
          layout: {
            type: "frame",
            layout: { width: 40, height: 24 },
            style: { background: { token: "toggle/off" } },
          },
        },
        {
          when: { Size: "M", On: "On" },
          layout: {
            type: "frame",
            layout: { width: 40, height: 24 },
            style: { background: { token: "toggle/on" } },
          },
        },
        {
          when: { Size: "L", On: "Off" },
          layout: {
            type: "frame",
            layout: { width: 56, height: 32 },
            style: { background: { token: "toggle/off" } },
          },
        },
        {
          when: { Size: "L", On: "On" },
          layout: {
            type: "frame",
            layout: { width: 56, height: 32 },
            style: { background: { token: "toggle/on" } },
          },
        },
      ],
    };

    const model = buildPseudocodeModelFromSpec(spec);
    expect(model.stats.templates).toBeGreaterThan(0);
    expect(model.stats.variantGroups).toBe(model.stats.templates);
    expect(model.variantGroups.flatMap((group) => group.rows).length).toBe(4);
  });
});
