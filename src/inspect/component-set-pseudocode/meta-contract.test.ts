import { describe, expect, it } from "vitest";
import { buildMetaContract } from "./meta-contract.js";

describe("buildMetaContract", () => {
  it("maps spec props and nested instance slots", () => {
    const componentSet = {
      id: "1:1",
      type: "COMPONENT_SET",
      name: "TextInput",
      children: [
        {
          type: "COMPONENT",
          name: "State=Default",
          children: [
            {
              type: "INSTANCE",
              name: "TextFootnote",
              children: [],
            },
          ],
        },
      ],
    };

    const meta = buildMetaContract(componentSet, {
      name: "TextInput",
      props: {
        icon: { type: "instance", default: "icon" },
        showName: { type: "boolean", default: true },
        State: {
          type: "variant",
          default: "Default",
          options: ["Default", "Hover"],
        },
      },
      baseVariant: { State: "Default" },
      variantAxes: { State: ["Default", "Hover"] },
      variants: [],
    });

    expect(meta.version).toBe(1);
    expect(meta.props?.icon).toEqual({ type: "instance", default: "icon" });
    expect(meta.props?.State?.options).toEqual(["Default", "Hover"]);
    expect(meta.slots?.icon).toEqual({ kind: "swap", component: "icon" });
    expect(meta.slots?.textFootnote).toEqual({
      kind: "nested",
      component: "TextFootnote",
    });
  });

  it("resolves team dependencies from published component sets", () => {
    const componentSet = {
      id: "1:10",
      type: "COMPONENT_SET",
      name: "TextInput",
      componentPropertyDefinitions: {
        icon: {
          type: "INSTANCE_SWAP",
          preferredValues: [{ type: "COMPONENT_SET", key: "icon-set-key" }],
        },
      },
      children: [
        {
          type: "COMPONENT",
          name: "State=Default",
          children: [{ type: "INSTANCE", name: "TextFootnote", children: [] }],
        },
      ],
    };

    const meta = buildMetaContract(
      componentSet,
      {
        name: "TextInput",
        props: { icon: { type: "instance", default: "icon" } },
        baseVariant: {},
        variantAxes: {},
        variants: [],
      },
      {
        teamComponents: {
          findByKey: (key) =>
            key === "icon-set-key"
              ? {
                  id: "2:1",
                  key: "icon-set-key",
                  name: "Icons",
                  fileKey: "file",
                  projectId: "1",
                }
              : undefined,
          findByName: (name) =>
            name === "TextFootnote"
              ? {
                  id: "3:1",
                  key: "footnote-key",
                  name: "TextFootnote",
                  fileKey: "file",
                  projectId: "1",
                }
              : name === "TextInput"
                ? {
                    id: "1:10",
                    key: "text-input-key",
                    name: "TextInput",
                    fileKey: "file",
                    projectId: "1",
                  }
                : undefined,
          findById: () => undefined,
        },
        component: {
          id: "1:10",
          key: "text-input-key",
          name: "TextInput",
          fileKey: "file",
          projectId: "1",
        },
      },
    );

    expect(meta.dependencies?.map((entry) => entry.name).sort()).toEqual([
      "Icons",
      "TextFootnote",
    ]);
  });
});
