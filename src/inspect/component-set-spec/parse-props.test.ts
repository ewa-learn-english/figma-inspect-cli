import { describe, expect, it } from "vitest";
import { parseComponentSetProps, parseVariantName } from "./parse-props.js";

describe("parseVariantName", () => {
  it("parses comma-separated axis pairs", () => {
    expect(parseVariantName("State=Default, Size=M")).toEqual({
      State: "Default",
      Size: "M",
    });
  });

  it("ignores segments without = or empty sides", () => {
    expect(parseVariantName("State=Default, broken, Size=")).toEqual({
      State: "Default",
    });
  });
});

describe("parseComponentSetProps", () => {
  it("maps Figma definitions to spec props and base variant defaults", () => {
    const { props, propIdToName, baseVariant } = parseComponentSetProps({
      componentPropertyDefinitions: {
        State: {
          type: "VARIANT",
          defaultValue: "Default",
          variantOptions: ["Default", "Hover"],
        },
        "Show icon#1": { type: "BOOLEAN", defaultValue: true },
        "Search Icon#2": {
          type: "INSTANCE_SWAP",
          defaultValue: "icon-key",
          preferredValues: [{ type: "COMPONENT_SET", key: "icons-set" }],
        },
        label: { type: "TEXT", defaultValue: "Go" },
      },
    });

    expect(props.State).toEqual({
      type: "variant",
      default: "Default",
      options: ["Default", "Hover"],
    });
    expect(props.showIcon).toEqual({ type: "boolean", default: true });
    expect(props.searchIcon).toEqual({
      type: "instance",
      default: "icon-key",
      swapSet: "icons-set",
    });
    expect(props.label).toEqual({ type: "text", default: "Go" });
    expect(baseVariant).toEqual({ State: "Default" });
    expect(propIdToName.get("Search Icon#2")).toBe("searchIcon");
  });

  it("returns empty maps when definitions are missing", () => {
    expect(parseComponentSetProps({})).toEqual({
      props: {},
      propIdToName: new Map(),
      baseVariant: {},
    });
  });
});
