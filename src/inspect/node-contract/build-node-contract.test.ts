import { describe, expect, it } from "vitest";
import { variablesFixturePath } from "../../test/fixtures.js";
import { FigmaInspectError } from "../errors.js";
import type { FileNodeEntry } from "../schemas.js";
import { buildNodeContractFromEntry } from "./build-node-contract.js";

function frameEntry(
  overrides: Partial<FileNodeEntry["document"]> = {},
): FileNodeEntry {
  return {
    document: {
      id: "208:43935",
      name: "Settings",
      type: "FRAME",
      isExposedInstance: false,
      layoutMode: "VERTICAL",
      itemSpacing: 12,
      absoluteBoundingBox: { width: 390, height: 844 },
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
      children: [
        {
          id: "208:43936",
          name: "Title",
          type: "TEXT",
          isExposedInstance: false,
          characters: "Settings",
          style: { fontSize: 24, fontWeight: 700 },
          fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
        },
        {
          id: "208:43937",
          name: "Cell",
          type: "INSTANCE",
          isExposedInstance: false,
          componentId: "3971:6466",
        },
      ],
      ...overrides,
    },
    componentSets: {
      "3971:6465": {
        id: "3971:6465",
        key: "set-key",
        name: "Cell",
      },
    },
    components: {
      "3971:6466": {
        key: "component-key",
        name: "State=Default",
        componentSetId: "3971:6465",
      },
    },
  };
}

describe("buildNodeContractFromEntry", () => {
  it("builds a frame contract without component-set variants", async () => {
    const contract = await buildNodeContractFromEntry({
      entry: frameEntry(),
      fileKey: "file-key",
      nodeId: "208:43935",
      sourceUrl:
        "https://www.figma.com/design/file-key/Settings?node-id=208-43935",
      variablesPath: variablesFixturePath,
    });

    expect(contract.kind).toBe("frame");
    expect(contract.nodeName).toBe("Settings");
    expect(contract.meta).toMatchObject({
      version: 1,
      kind: "frame",
      node: { id: "208:43935", name: "Settings", type: "FRAME" },
      dependencies: {
        componentSets: [{ nodeId: "3971:6465", key: "set-key", name: "Cell" }],
        components: [
          {
            nodeId: "3971:6466",
            key: "component-key",
            componentSetId: "3971:6465",
          },
        ],
      },
    });
    expect(contract.geometry.root).toMatchObject({
      layoutMode: "column",
      gap: 12,
      width: 390,
      height: 844,
    });
    expect(contract.visuals.root).toMatchObject({ background: "#ffffff" });
    expect(contract.structureDsl).toContain('node frame "Settings"');
    expect(contract.structureDsl).toContain("Settings.frame.visuals.yaml");
    expect(contract.lock).toMatchObject({
      version: 1,
      kind: "frame",
      source: {
        fileKey: "file-key",
        nodeId: "208:43935",
        nodeType: "FRAME",
        name: "Settings",
      },
    });
  });

  it("builds a standalone component contract with component properties", async () => {
    const contract = await buildNodeContractFromEntry({
      entry: frameEntry({
        id: "900:1",
        name: "Icon Button",
        type: "COMPONENT",
        componentPropertyDefinitions: {
          label: { type: "TEXT", defaultValue: "Save" },
          disabled: { type: "BOOLEAN", defaultValue: false },
        },
      }),
      fileKey: "file-key",
      nodeId: "900:1",
      variablesPath: variablesFixturePath,
    });

    expect(contract.kind).toBe("component");
    expect(contract.nodeName).toBe("Icon Button");
    expect(contract.meta.componentProperties).toEqual({
      label: { type: "TEXT", default: "Save" },
      disabled: { type: "BOOLEAN", default: false },
    });
    expect(contract.structureDsl).toContain('node component "Icon Button"');
  });

  it("rejects components inside component sets", async () => {
    await expect(
      buildNodeContractFromEntry({
        entry: {
          ...frameEntry({ id: "3971:6466", type: "COMPONENT" }),
          components: {
            "3971:6466": {
              key: "component-key",
              name: "State=Default",
              componentSetId: "3971:6465",
            },
          },
        },
        fileKey: "file-key",
        nodeId: "3971:6466",
        variablesPath: variablesFixturePath,
      }),
    ).rejects.toThrow(/use --export-component-set/);
  });

  it("rejects unsupported node types", async () => {
    await expect(
      buildNodeContractFromEntry({
        entry: frameEntry({ type: "INSTANCE" }),
        fileKey: "file-key",
        nodeId: "208:43937",
        variablesPath: variablesFixturePath,
      }),
    ).rejects.toThrow(FigmaInspectError);
  });
});
