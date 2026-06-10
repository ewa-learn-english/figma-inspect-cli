import type {
  ComponentSetSpec,
  SlimNode,
} from "../component-set-spec/types.js";
import type { PseudocodeModel } from "./types.js";
import {
  extractGeometryFromNode,
  extractVisualsFromNode,
  mergeNestedContracts,
  mergeNodeBundle,
  type NodeBundle,
  orderedAxes,
  setNestedBundle,
} from "./universal.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRef(value: unknown): value is { $ref: string } {
  return isRecord(value) && typeof value.$ref === "string";
}

function isVar(value: unknown): value is { $var: string } {
  return isRecord(value) && typeof value.$var === "string";
}

function isNode(value: unknown): value is SlimNode {
  return isRecord(value) && typeof value.type === "string";
}

function propName(raw: string): string {
  const words = raw
    .replace(/[^A-Za-z0-9_$]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return "value";
  }
  const [first = "value", ...rest] = words;
  return [
    first.charAt(0).toLowerCase() + first.slice(1),
    ...rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)),
  ].join("");
}

function nodeKey(node: SlimNode, options: { root?: boolean } = {}): string {
  if (options.root) {
    return "root";
  }
  if (typeof node.name === "string" && node.name.length > 0) {
    return propName(node.name);
  }
  if (typeof node.prop === "string" && node.prop.length > 0) {
    return propName(node.prop);
  }
  if (node.component && typeof node.component !== "string") {
    return propName(node.component.name ?? "instance");
  }
  return node.type;
}

function unwrapRoot(node: SlimNode): SlimNode {
  if (node.type === "component") {
    return {
      ...node,
      type: "frame",
    };
  }
  return node;
}

function collectDefinitions(model: PseudocodeModel): Record<string, SlimNode> {
  return {
    ...(model.definitions as Record<string, SlimNode>),
    ...Object.fromEntries(
      model.definitionTemplates.map((template) => [
        template.name,
        template.node as SlimNode,
      ]),
    ),
  };
}

function walkSlimNode(
  node: SlimNode,
  definitions: Record<string, SlimNode>,
  options: { root?: boolean },
  visit: (key: string, node: SlimNode) => void,
): void {
  visit(nodeKey(node, options), node);

  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    if (isRef(child)) {
      const definition = definitions[child.$ref];
      if (definition) {
        walkSlimNode(definition, definitions, {}, visit);
      }
      continue;
    }
    if (isVar(child)) {
      continue;
    }
    if (isNode(child)) {
      walkSlimNode(child, definitions, {}, visit);
    }
  }
}

export function buildBaselineContracts(
  spec: ComponentSetSpec,
  model: PseudocodeModel,
): {
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
} {
  const axes = orderedAxes(model);
  const definitions = collectDefinitions(model);
  const visualsRoot: Record<string, unknown> = {};
  const geometryRoot: Record<string, unknown> = {};

  for (const variant of spec.variants) {
    const visualBundle: NodeBundle = {};
    const geometryBundle: NodeBundle = {};

    walkSlimNode(
      unwrapRoot(variant.layout),
      definitions,
      { root: true },
      (key, node) => {
        mergeNodeBundle(
          visualBundle,
          key,
          extractVisualsFromNode(node as unknown as Record<string, unknown>),
          {},
        );
        mergeNodeBundle(
          geometryBundle,
          key,
          {},
          extractGeometryFromNode(node as unknown as Record<string, unknown>),
        );
      },
    );

    if (Object.keys(visualBundle).length > 0) {
      setNestedBundle(visualsRoot, axes, variant.when, visualBundle);
    }
    if (Object.keys(geometryBundle).length > 0) {
      setNestedBundle(geometryRoot, axes, variant.when, geometryBundle);
    }
  }

  return { visuals: visualsRoot, geometry: geometryRoot };
}

export function mergeBaselineWithVariantContracts(
  baseline: {
    visuals: Record<string, unknown>;
    geometry: Record<string, unknown>;
  },
  variant: {
    visuals: Record<string, unknown>;
    geometry: Record<string, unknown>;
  },
  axesDepth: number,
): { visuals: Record<string, unknown>; geometry: Record<string, unknown> } {
  return {
    visuals: mergeNestedContracts(
      baseline.visuals,
      variant.visuals,
      0,
      axesDepth,
    ),
    geometry: mergeNestedContracts(
      baseline.geometry,
      variant.geometry,
      0,
      axesDepth,
    ),
  };
}
