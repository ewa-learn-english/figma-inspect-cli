import { describe, expect, it } from "vitest";
import type {
  ComponentSetSpec,
  SlimNode,
} from "../component-set-spec/types.js";
import { buildStructureContract } from "./structure-contract.js";
import { renderStructureDsl } from "./structure-dsl.js";
import type { PseudocodeModel } from "./types.js";

describe("renderStructureDsl", () => {
  it("renders props, contracts, resolve, and templates", () => {
    const model: PseudocodeModel = {
      name: "Badge",
      props: {
        visible: { type: "boolean", default: true },
        label: { type: "text", default: "New" },
        tone: {
          type: "variant",
          default: "Neutral",
          options: ["Neutral", "Positive"],
        },
      },
      baseVariant: { tone: "Neutral" },
      variantAxes: { tone: ["Neutral", "Positive"] },
      definitions: {},
      definitionTemplates: [],
      templates: [
        {
          name: "allVariants",
          variables: [],
          layout: {
            type: "frame",
            name: "Root",
            layout: { mode: "row", width: 32, height: 16 },
            children: [
              {
                type: "text",
                name: "Label",
                prop: "label",
                visible: "visible",
                text: { content: "New" },
              },
            ],
          },
        },
      ],
      variantGroups: [],
      stats: {
        variants: 2,
        definitions: 0,
        definitionTemplates: 0,
        templates: 1,
        variantGroups: 0,
      },
    };

    const spec = {
      name: "Badge",
      props: model.props,
      baseVariant: model.baseVariant,
      variantAxes: model.variantAxes,
      variants: [
        {
          when: { tone: "Neutral" },
          layout: model.templates[0].layout as NonNullable<
            PseudocodeModel["templates"][number]["layout"]
          >,
        },
      ],
    };

    const dsl = renderStructureDsl(buildStructureContract(model, spec));
    expect(dsl).toContain("component Badge");
    expect(dsl).toContain("visible boolean = true");
    expect(dsl).toContain('tone variant = "Neutral"');
    expect(dsl).toContain("resolve {");
    expect(dsl).toContain("scheme = visuals[tone]");
    expect(dsl).toContain("Text label when visible");
    expect(dsl).toContain(`content \${label}`);
  });

  it("includes asset resolve bindings for asset-backed contracts", () => {
    const model: PseudocodeModel = {
      name: "ProfileStreakIcon",
      props: {
        Status: {
          type: "variant",
          default: "Missed",
          options: ["Active", "Missed", "Loading"],
        },
        Size: { type: "variant", default: "M", options: ["M", "XL"] },
      },
      baseVariant: { Status: "Missed", Size: "M" },
      variantAxes: {
        Size: ["M", "XL"],
        Status: ["Active", "Loading", "Missed"],
      },
      definitions: {},
      definitionTemplates: [],
      templates: [],
      variantGroups: [],
      stats: {
        variants: 6,
        definitions: 0,
        definitionTemplates: 0,
        templates: 0,
        variantGroups: 0,
      },
    };

    const dsl = renderStructureDsl(
      buildStructureContract(
        model,
        {
          name: model.name,
          props: model.props,
          baseVariant: model.baseVariant,
          variantAxes: model.variantAxes,
          variants: [],
        },
        { assetBacked: true },
      ),
    );

    expect(dsl).toContain("asset = meta.assets[Size][Status]");
    expect(dsl).toContain("Asset root");
    expect(dsl).toContain("asset asset");
  });

  it("renders templated component names without treating variables as prop names", () => {
    const layout: SlimNode = {
      type: "frame",
      name: "Buttons",
      children: [
        {
          type: "instance",
          component: {
            name: { $var: "item1ComponentName" } as unknown as string,
          },
        },
      ],
    };
    const model: PseudocodeModel = {
      name: "ButtonsContainer",
      props: {},
      baseVariant: {},
      variantAxes: {},
      definitions: {},
      definitionTemplates: [],
      templates: [
        {
          name: "allVariants",
          variables: ["item1ComponentName"],
          layout,
        },
      ],
      variantGroups: [],
      stats: {
        variants: 1,
        definitions: 0,
        definitionTemplates: 0,
        templates: 1,
        variantGroups: 0,
      },
    };
    const spec: ComponentSetSpec = {
      name: model.name,
      props: model.props,
      baseVariant: model.baseVariant,
      variantAxes: model.variantAxes,
      variants: [{ when: {}, layout }],
    };

    const dsl = renderStructureDsl(buildStructureContract(model, spec));

    expect(dsl).toContain("component ButtonsContainer");
    expect(dsl).toContain("Instance instance");
  });
});
