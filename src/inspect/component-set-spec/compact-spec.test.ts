import { describe, expect, it } from "vitest";
import { compactSpec } from "./compact-spec.js";
import type { ComponentSetSpec } from "./types.js";

describe("compactSpec", () => {
  it("drops default borders, zero grow, and redundant fills", () => {
    const spec: ComponentSetSpec = {
      name: "Badge",
      props: {},
      baseVariant: {},
      variantAxes: {},
      variants: [
        {
          when: { State: "Default" },
          layout: {
            type: "frame",
            layout: {
              grow: 0,
              alignSelf: "INHERIT",
            },
            style: {
              background: { type: "solid", color: "#ffffff" },
              fills: [{ type: "solid", color: "#ffffff" }],
              border: { width: 1 },
            },
            text: {
              content: "New",
              verticalAlign: "TOP",
              autoResize: "HEIGHT",
              align: "LEFT",
            },
          },
        },
      ],
    };

    expect(compactSpec(spec).variants[0]?.layout).toEqual({
      type: "frame",
      text: {
        content: "New",
        align: "LEFT",
      },
      style: {
        background: { type: "solid", color: "#ffffff" },
      },
    });
  });

  it("keeps token-only dimensions and non-default borders", () => {
    const spec: ComponentSetSpec = {
      name: "Badge",
      props: {},
      baseVariant: {},
      variantAxes: {},
      variants: [
        {
          when: { State: "Default" },
          layout: {
            type: "frame",
            layout: {
              gap: { token: "spacing/sm" },
            },
            style: {
              border: { token: "border/default", width: 2 },
            },
          },
        },
      ],
    };

    expect(compactSpec(spec).variants[0]?.layout).toEqual({
      type: "frame",
      layout: {
        gap: { token: "spacing/sm" },
      },
      style: {
        border: { token: "border/default", width: 2 },
      },
    });
  });
});
