import { normalizePropName } from "../component-set-spec/prop-name.js";
import type {
  ComponentSetPropDefinition,
  ComponentSetSpec,
  SlimNode,
} from "../component-set-spec/types.js";
import type { ContractFormat } from "../contract-format.js";
import { contractArtifactFileName } from "../contract-format.js";
import type { PseudocodeModel } from "./types.js";

export interface StructureContract {
  version: 1;
  component: string;
  contracts: {
    visuals: string;
    geometry: string;
    meta: string;
  };
  props?: Record<string, ComponentSetPropDefinition>;
  variantAxes: Record<string, string[]>;
  baseVariant: Record<string, string>;
  instances: Record<
    string,
    { swapSet?: string; default?: string; component?: string }
  >;
  fragments: Record<string, StructureFragment>;
  templates: Record<string, StructureTemplate>;
  dispatch: StructureDispatchEntry[];
  fallback: string | null;
  assetBacked?: boolean;
}

interface StructureFragment {
  when?: StructureWhen[];
  node: StructureNode;
}

interface StructureTemplate {
  when?: Record<string, string>;
  root: StructureNode;
}

interface StructureDispatchEntry {
  when: Record<string, string>;
  template: string;
}

interface StructureWhen {
  prop: string;
}

export type StructureNode =
  | StructureElementNode
  | StructureUseNode
  | StructureSlotNode;

interface StructureBinding {
  $ref: string;
}

interface StructurePropRef {
  $prop: string;
}

interface StructureUseNode {
  $use: string;
}

interface StructureSlotNode {
  $slot: string;
}

interface StructureElementNode {
  type: string;
  name?: string;
  key: string;
  when?: StructureWhen[];
  content?: StructurePropRef | string;
  instance?: StructurePropRef | string;
  asset?: StructureBinding;
  style?: StructureBinding;
  layout?: StructureBinding;
  children?: StructureNode[];
}

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

function toTagName(raw: string | undefined, fallback: string): string {
  if (!raw) {
    return fallback;
  }
  const words = raw
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return fallback;
  }
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function stackType(node: SlimNode): string {
  const layout = node.layout;
  if (layout?.mode === "row") {
    return "HStack";
  }
  if (layout?.mode === "column") {
    return "VStack";
  }
  return "Box";
}

function structureType(node: SlimNode): string {
  if (node.type === "text") {
    return "Text";
  }
  if (node.icon) {
    return "Icon";
  }
  if (node.type === "component" && node.component) {
    if (typeof node.component === "string") {
      return toTagName(node.component, "Component");
    }
    return toTagName(node.component.name, "Component");
  }
  if (node.type === "instance" && node.component) {
    if (node.icon) {
      return "Icon";
    }
    if (typeof node.component === "string") {
      return toTagName(node.component, "Instance");
    }
    return toTagName(node.component.name, "Instance");
  }
  if (
    node.type === "line" ||
    node.type === "vector" ||
    node.type === "rectangle" ||
    node.type === "ellipse"
  ) {
    return "Shape";
  }
  if (node.type === "component") {
    return stackType(node);
  }
  return stackType(node);
}

function visibleWhen(visible: unknown): StructureWhen[] | undefined {
  if (typeof visible !== "string" || visible.length === 0) {
    return undefined;
  }
  return [{ prop: normalizePropName(visible) }];
}

function nodeKey(node: SlimNode, options: { root?: boolean } = {}): string {
  if (options.root) {
    return "root";
  }
  if (typeof node.name === "string" && node.name.length > 0) {
    return normalizePropName(node.name);
  }
  if (typeof node.prop === "string" && node.prop.length > 0) {
    return normalizePropName(node.prop);
  }
  if (node.component && typeof node.component !== "string") {
    return normalizePropName(node.component.name ?? "instance");
  }
  return node.type;
}

function schemeRef(key: string): StructureBinding {
  return { $ref: `scheme.${key}` };
}

function geometryRef(key: string): StructureBinding {
  return { $ref: `geometry.${key}` };
}

function contentRef(node: SlimNode): StructurePropRef | string | undefined {
  if (typeof node.prop === "string" && node.prop.length > 0) {
    return { $prop: normalizePropName(node.prop) };
  }
  if (node.text && typeof node.text.content === "string") {
    return node.text.content;
  }
  return undefined;
}

function instanceRef(node: SlimNode): StructurePropRef | string | undefined {
  if (typeof node.prop === "string" && node.prop.length > 0) {
    return { $prop: normalizePropName(node.prop) };
  }
  if (node.component && typeof node.component !== "string") {
    return node.component.name;
  }
  if (typeof node.component === "string") {
    return node.component;
  }
  if (typeof node.name === "string") {
    return node.name;
  }
  return undefined;
}

function convertChild(
  child: unknown,
  definitions: Record<string, SlimNode>,
): StructureNode {
  if (isRef(child)) {
    return { $use: child.$ref };
  }
  if (isVar(child)) {
    return { $slot: child.$var };
  }
  if (!isNode(child)) {
    return { $slot: "unknown" };
  }
  return convertNode(child, definitions);
}

function convertNode(
  node: SlimNode,
  definitions: Record<string, SlimNode>,
  options: { root?: boolean } = {},
): StructureNode {
  const key = nodeKey(node, options);
  const element: StructureElementNode = {
    type: structureType(node),
    key,
    style: schemeRef(key),
    layout: geometryRef(key),
  };

  if (typeof node.name === "string") {
    element.name = node.name;
  }

  const when = visibleWhen(node.visible);
  if (when) {
    element.when = when;
  }

  if (element.type === "Text") {
    const content = contentRef(node);
    if (content !== undefined) {
      element.content = content;
    }
  } else if (element.type === "Icon") {
    const instance = instanceRef(node);
    if (instance !== undefined) {
      element.instance = instance;
    }
  } else if (
    element.type !== "HStack" &&
    element.type !== "VStack" &&
    element.type !== "Box" &&
    element.type !== "Shape"
  ) {
    const instance = instanceRef(node);
    if (instance !== undefined) {
      element.instance = instance;
    }
  }

  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length > 0) {
    element.children = children.map((child) =>
      convertChild(child, definitions),
    );
  }

  return element;
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

function convertRoot(
  node: SlimNode,
  definitions: Record<string, SlimNode>,
): StructureNode {
  return convertNode(unwrapRoot(node), definitions, { root: true });
}

function findRepresentativeLayout(
  spec: ComponentSetSpec,
  when: Record<string, string> | undefined,
): SlimNode | undefined {
  if (!when || Object.keys(when).length === 0) {
    return spec.variants[0]?.layout;
  }

  return spec.variants.find((variant) =>
    Object.entries(when).every(([axis, value]) => variant.when[axis] === value),
  )?.layout;
}

function collectInstances(
  model: PseudocodeModel,
): StructureContract["instances"] {
  const instances: StructureContract["instances"] = {};
  for (const [name, definition] of Object.entries(model.props)) {
    if (definition.type !== "instance") {
      continue;
    }
    instances[normalizePropName(name)] = {
      default:
        typeof definition.default === "string" ? definition.default : undefined,
      swapSet: definition.swapSet,
    };
  }
  return instances;
}

function convertFragment(
  node: SlimNode,
  definitions: Record<string, SlimNode>,
): StructureFragment {
  const converted = convertNode(unwrapRoot(node), definitions);
  const when = visibleWhen(node.visible);
  return {
    when,
    node: converted,
  };
}

function buildAssetBackedStructureContract(
  model: PseudocodeModel,
  format: ContractFormat,
): StructureContract {
  const templateName = "allVariants";
  const root: StructureElementNode = {
    type: "Asset",
    key: "root",
    asset: { $ref: "asset" },
    layout: geometryRef("root"),
  };

  return {
    version: 1,
    component: model.name,
    contracts: {
      visuals: contractArtifactFileName(model.name, "visuals", format),
      geometry: contractArtifactFileName(model.name, "geometry", format),
      meta: contractArtifactFileName(model.name, "meta", format),
    },
    props: model.props,
    variantAxes: model.variantAxes,
    baseVariant: model.baseVariant,
    instances: collectInstances(model),
    fragments: {},
    templates: {
      [templateName]: {
        root,
      },
    },
    dispatch: [],
    fallback: templateName,
    assetBacked: true,
  };
}

export function buildStructureContract(
  model: PseudocodeModel,
  spec: ComponentSetSpec,
  options: { assetBacked?: boolean; format?: ContractFormat } = {},
): StructureContract {
  const format = options.format ?? "yaml";
  if (options.assetBacked) {
    return buildAssetBackedStructureContract(model, format);
  }
  const definitions: Record<string, SlimNode> = {
    ...(model.definitions as Record<string, SlimNode>),
    ...Object.fromEntries(
      model.definitionTemplates.map((template) => [
        template.name,
        template.node as SlimNode,
      ]),
    ),
  };

  const fragments: Record<string, StructureFragment> = {};
  for (const template of model.definitionTemplates) {
    fragments[template.name] = convertFragment(
      template.node as SlimNode,
      definitions,
    );
  }
  for (const [id, node] of Object.entries(model.definitions)) {
    if (fragments[id]) {
      continue;
    }
    fragments[id] = convertFragment(node, definitions);
  }

  const templates: Record<string, StructureTemplate> = {};
  for (const template of model.templates) {
    const layout = findRepresentativeLayout(spec, template.when);
    if (!layout) {
      continue;
    }
    templates[template.name] = {
      when: template.when,
      root: convertRoot(layout, definitions),
    };
  }

  const dispatch: StructureDispatchEntry[] = model.templates
    .filter(
      (template) => template.when && Object.keys(template.when).length > 0,
    )
    .map((template) => ({
      when: template.when ?? {},
      template: template.name,
    }));

  const fallback = model.templates[0]?.name ?? null;

  return {
    version: 1,
    component: model.name,
    contracts: {
      visuals: contractArtifactFileName(model.name, "visuals", format),
      geometry: contractArtifactFileName(model.name, "geometry", format),
      meta: contractArtifactFileName(model.name, "meta", format),
    },
    props: model.props,
    variantAxes: model.variantAxes,
    baseVariant: model.baseVariant,
    instances: collectInstances(model),
    fragments,
    templates,
    dispatch,
    fallback,
  };
}
