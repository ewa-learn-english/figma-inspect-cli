import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FigmaInspectError } from "../errors.js";
import {
  buildComponentSetSpecFromFile,
  buildComponentSetSpecFromRaw,
  readComponentSetFile,
} from "./build-spec.js";

const minimalComponentSet = {
  type: "COMPONENT_SET",
  name: "Button",
  componentPropertyDefinitions: {
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Hover"],
    },
    "Label#1": { type: "TEXT", defaultValue: "Click" },
  },
  children: [
    {
      type: "COMPONENT",
      name: "State=Default",
      layoutMode: "HORIZONTAL",
      itemSpacing: 8,
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 8,
      paddingLeft: 12,
      absoluteBoundingBox: { width: 96, height: 32 },
      children: [
        {
          type: "TEXT",
          name: "Label",
          characters: "Click",
          componentPropertyReferences: { characters: "Label#1" },
          style: { fontFamily: "Inter", fontSize: 14, fontWeight: 500 },
        },
      ],
    },
    {
      type: "COMPONENT",
      name: "State=Hover",
      layoutMode: "HORIZONTAL",
      absoluteBoundingBox: { width: 96, height: 32 },
      children: [
        {
          type: "TEXT",
          name: "Label",
          characters: "Click",
          componentPropertyReferences: { characters: "Label#1" },
        },
      ],
    },
  ],
};

describe("buildComponentSetSpecFromRaw", () => {
  it("builds props, axes, and slim variant trees from a component set", async () => {
    const spec = await buildComponentSetSpecFromRaw(minimalComponentSet);

    expect(spec.name).toBe("Button");
    expect(spec.props.State).toEqual({
      type: "variant",
      default: "Default",
      options: ["Default", "Hover"],
    });
    expect(spec.props.label).toEqual({ type: "text", default: "Click" });
    expect(spec.baseVariant).toEqual({ State: "Default" });
    expect(spec.variantAxes).toEqual({ State: ["Default", "Hover"] });
    expect(spec.variants).toHaveLength(2);
    expect(spec.variants[0]?.when).toEqual({ State: "Default" });
    expect(spec.variants[0]?.layout).toMatchObject({
      type: "component",
      layout: { mode: "row", gap: 8 },
      children: [{ type: "text", prop: "label", text: { content: "Click" } }],
    });
  });

  it("resolves design tokens when a variables file is provided", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "figma-inspect-spec-"));
    const variablesPath = path.join(dir, "variables.json");
    await writeFile(
      variablesPath,
      JSON.stringify({
        variables: {
          spacing: {
            id: "VariableID:spacing-sm",
            key: "spacing-sm",
            name: "spacing/sm",
          },
        },
      }),
    );

    const componentSet = structuredClone(minimalComponentSet);
    componentSet.children[0] = {
      ...componentSet.children[0],
      boundVariables: {
        itemSpacing: { type: "VARIABLE_ALIAS", id: "VariableID:spacing-sm" },
      },
    };

    const spec = await buildComponentSetSpecFromRaw(componentSet, {
      variablesPath,
    });

    expect(spec.variants[0]?.layout.layout?.gap).toEqual({
      token: "spacing/sm",
    });
  });
});

describe("readComponentSetFile", () => {
  it("loads a COMPONENT_SET JSON file from disk", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "figma-inspect-spec-"));
    const inputPath = path.join(dir, "button.json");
    await writeFile(inputPath, JSON.stringify(minimalComponentSet));

    await expect(readComponentSetFile(inputPath)).resolves.toMatchObject({
      type: "COMPONENT_SET",
      name: "Button",
    });
  });

  it("rejects non-component-set roots", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "figma-inspect-spec-"));
    const inputPath = path.join(dir, "frame.json");
    await writeFile(inputPath, JSON.stringify({ type: "FRAME" }));

    await expect(readComponentSetFile(inputPath)).rejects.toThrow(
      FigmaInspectError,
    );
  });
});

describe("buildComponentSetSpecFromFile", () => {
  it("reads input from disk and builds a compact spec", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "figma-inspect-spec-"));
    const inputPath = path.join(dir, "button.json");
    await writeFile(inputPath, JSON.stringify(minimalComponentSet));

    const spec = await buildComponentSetSpecFromFile(inputPath);

    expect(spec.name).toBe("Button");
    expect(spec.variants.map((variant) => variant.when)).toEqual([
      { State: "Default" },
      { State: "Hover" },
    ]);
  });
});
