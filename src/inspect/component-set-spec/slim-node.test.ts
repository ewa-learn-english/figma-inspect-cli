import { describe, expect, it } from "vitest";
import { slimNode } from "./slim-node.js";
import { TeamComponentRegistry } from "./team-component-registry.js";

const emptyContext = { propIdToName: new Map<string, string>() };

describe("slimNode", () => {
  it("binds text nodes to normalized prop names", () => {
    const propIdToName = new Map([["Label#1", "label"]]);

    expect(
      slimNode(
        {
          type: "TEXT",
          name: "Label",
          characters: "Save",
          componentPropertyReferences: { characters: "Label#1" },
          style: { fontFamily: "Inter", fontSize: 14, fontWeight: 600 },
        },
        { propIdToName },
      ),
    ).toEqual({
      name: "Label",
      type: "text",
      prop: "label",
      text: {
        content: "Save",
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: 600,
      },
    });
  });

  it("extracts icon size and color from single-vector instances", () => {
    const slim = slimNode(
      {
        type: "INSTANCE",
        name: "SearchIcon",
        absoluteBoundingBox: { width: 16, height: 16 },
        children: [
          {
            type: "VECTOR",
            fills: [
              {
                type: "SOLID",
                color: { r: 0, g: 0, b: 0, a: 1 },
              },
            ],
          },
        ],
      },
      emptyContext,
    );

    expect(slim?.type).toBe("instance");
    expect(slim?.icon).toEqual({
      size: 16,
      color: { type: "solid", color: "#000000", opacity: 1 },
    });
  });

  it("promotes known team components to component nodes with slots", () => {
    const registry = TeamComponentRegistry.fromEntries([
      {
        id: "1:99",
        key: "avatar-key",
        name: "Avatar",
        fileKey: "file-key",
        projectId: "project-id",
      },
    ]);

    expect(
      slimNode(
        {
          type: "INSTANCE",
          name: "Avatar",
          componentId: "1:99",
          componentProperties: {
            CloseIcon: { value: "DismissIcon" },
          },
        },
        { propIdToName: new Map(), teamComponents: registry },
      ),
    ).toEqual({
      name: "Avatar",
      type: "component",
      component: "Avatar",
      slots: { icon: "DismissIcon" },
    });
  });

  it("maps auto-layout frames to row layout with spacing and padding", () => {
    expect(
      slimNode(
        {
          type: "FRAME",
          name: "Root",
          layoutMode: "HORIZONTAL",
          itemSpacing: 8,
          paddingTop: 12,
          paddingRight: 16,
          paddingBottom: 12,
          paddingLeft: 16,
          absoluteBoundingBox: { width: 120, height: 40 },
        },
        emptyContext,
      ),
    ).toEqual({
      name: "Root",
      type: "frame",
      layout: {
        mode: "row",
        gap: 8,
        padding: { top: 12, right: 16, bottom: 12, left: 16 },
        width: 120,
        height: 40,
      },
    });
  });
});
