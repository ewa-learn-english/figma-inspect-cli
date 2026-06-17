import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  isRecord,
  readBoolean,
  readChildren,
  readNumber,
  readRecord,
  readString,
} from "../component-set-spec/figma-node.js";
import {
  parseComponentSetProps,
  parseVariantName,
} from "../component-set-spec/parse-props.js";
import type { TeamComponentRegistry } from "../component-set-spec/team-component-registry.js";
import type { VariableRegistry } from "../component-set-spec/variable-registry.js";
import type { DocumentNode } from "../schemas.js";
import { stableStringify } from "./stable-stringify.js";

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function fingerprintTree(tree: DocumentNode): string {
  return sha256Hex(stableStringify(tree));
}

type SurfaceValue =
  | null
  | boolean
  | number
  | string
  | SurfaceValue[]
  | { [key: string]: SurfaceValue };

const layoutKeys = [
  "layoutMode",
  "layoutWrap",
  "layoutPositioning",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "itemSpacing",
  "counterAxisSpacing",
  "layoutGrow",
  "layoutAlign",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "clipsContent",
] as const;

const textStyleKeys = [
  "fontFamily",
  "fontPostScriptName",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textAlignHorizontal",
  "textAlignVertical",
  "textAutoResize",
  "lineHeightPx",
  "lineHeightPercent",
  "lineHeightUnit",
  "letterSpacing",
  "paragraphSpacing",
  "paragraphIndent",
  "listSpacing",
] as const;

const paintKeys = [
  "type",
  "visible",
  "opacity",
  "blendMode",
  "color",
  "boundVariables",
  "gradientStops",
  "imageRef",
  "scaleMode",
  "scalingFactor",
] as const;

const effectKeys = [
  "type",
  "visible",
  "radius",
  "spread",
  "offset",
  "color",
  "blendMode",
  "showShadowBehindNode",
] as const;

function pruneSurfaceRecord(
  value: Record<string, SurfaceValue | undefined>,
): Record<string, SurfaceValue> | undefined {
  const entries = Object.entries(value).filter(([, entry]) => {
    if (entry === undefined) {
      return false;
    }
    if (Array.isArray(entry)) {
      return entry.length > 0;
    }
    if (isRecord(entry)) {
      return Object.keys(entry).length > 0;
    }
    return true;
  }) as [string, SurfaceValue][];

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function variableAliasId(value: unknown): string | undefined {
  if (!isRecord(value) || readString(value, "type") !== "VARIABLE_ALIAS") {
    return undefined;
  }

  return readString(value, "id")?.replace(/^VariableID:/, "");
}

function normalizeSurfaceValue(
  value: unknown,
  variables?: VariableRegistry,
): SurfaceValue | undefined {
  const variable = variableAliasId(value);
  if (variable) {
    const token = variables?.resolve(variable);
    return token ? { token } : { variable };
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeSurfaceValue(entry, variables))
      .filter((entry): entry is SurfaceValue => entry !== undefined);
    return normalized.length > 0 ? normalized : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Record<string, SurfaceValue | undefined> = {};
  for (const [key, entry] of Object.entries(value)) {
    normalized[key] = normalizeSurfaceValue(entry, variables);
  }

  return pruneSurfaceRecord(normalized);
}

function normalizePickedRecord(
  value: unknown,
  keys: readonly string[],
  variables?: VariableRegistry,
): SurfaceValue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Record<string, SurfaceValue | undefined> = {};
  for (const key of keys) {
    if (key in value) {
      normalized[key] = normalizeSurfaceValue(value[key], variables);
    }
  }

  return pruneSurfaceRecord(normalized);
}

function normalizePaintList(
  value: unknown,
  variables?: VariableRegistry,
): SurfaceValue | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const paints = value
    .map((paint) => normalizePickedRecord(paint, paintKeys, variables))
    .filter((paint): paint is SurfaceValue => paint !== undefined);

  return paints.length > 0 ? paints : undefined;
}

function normalizeEffects(
  value: unknown,
  variables?: VariableRegistry,
): SurfaceValue | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const effects = value
    .map((effect) => normalizePickedRecord(effect, effectKeys, variables))
    .filter((effect): effect is SurfaceValue => effect !== undefined);

  return effects.length > 0 ? effects : undefined;
}

function normalizeDimensions(node: DocumentNode): SurfaceValue | undefined {
  const box = readRecord(node, "absoluteBoundingBox");
  if (!box) {
    return undefined;
  }

  return pruneSurfaceRecord({
    width: readNumber(box, "width"),
    height: readNumber(box, "height"),
  });
}

function normalizeComponentIdentity(
  node: DocumentNode,
  teamComponents?: TeamComponentRegistry,
): SurfaceValue | undefined {
  const componentId = readString(node, "componentId");
  if (!componentId) {
    return undefined;
  }

  const teamComponent =
    teamComponents?.findById(componentId) ??
    (node.name ? teamComponents?.findByName(node.name) : undefined);

  return pruneSurfaceRecord({
    id: componentId,
    key: teamComponent?.key,
    name: teamComponent?.name ?? readString(node, "name"),
    fileKey: teamComponent?.fileKey,
  });
}

function normalizeComponentProperties(
  value: unknown,
  variables?: VariableRegistry,
): SurfaceValue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const properties: Record<string, SurfaceValue | undefined> = {};
  for (const [key, rawProperty] of Object.entries(value)) {
    properties[key] = normalizePickedRecord(
      rawProperty,
      ["type", "value", "boundVariables"],
      variables,
    );
  }

  return pruneSurfaceRecord(properties);
}

function normalizeComponentDefinitions(
  node: DocumentNode,
  variables?: VariableRegistry,
): SurfaceValue | undefined {
  if (node.type === "COMPONENT_SET") {
    const { props, baseVariant } = parseComponentSetProps(node);
    const variantNames = readChildren(node)
      .filter((child) => readString(child, "type") === "COMPONENT")
      .map((child) => readString(child, "name"))
      .filter((name): name is string => name !== undefined);
    const variants = variantNames.map((name) => ({
      name,
      when: parseVariantName(name),
    }));

    return pruneSurfaceRecord({
      props: normalizeSurfaceValue(props, variables),
      baseVariant: normalizeSurfaceValue(baseVariant, variables),
      variants: normalizeSurfaceValue(variants, variables),
    });
  }

  const definitions = readRecord(node, "componentPropertyDefinitions");
  if (!definitions) {
    return undefined;
  }

  const normalized: Record<string, SurfaceValue | undefined> = {};
  for (const [key, definition] of Object.entries(definitions)) {
    normalized[key] = normalizePickedRecord(
      definition,
      [
        "type",
        "defaultValue",
        "variantOptions",
        "preferredValues",
        "boundVariables",
      ],
      variables,
    );
  }

  return pruneSurfaceRecord(normalized);
}

function normalizeSurfaceNode(
  node: DocumentNode,
  variables?: VariableRegistry,
  teamComponents?: TeamComponentRegistry,
): SurfaceValue | undefined {
  const visible = readBoolean(node, "visible");
  const variant =
    node.type === "COMPONENT" && node.name
      ? pruneSurfaceRecord(parseVariantName(node.name))
      : undefined;
  const children = readChildren(node)
    .map((child) =>
      normalizeSurfaceNode(child as DocumentNode, variables, teamComponents),
    )
    .filter((child): child is SurfaceValue => child !== undefined);

  return pruneSurfaceRecord({
    type: readString(node, "type"),
    name: readString(node, "name"),
    hidden: visible === false ? true : undefined,
    component: normalizeComponentIdentity(node, teamComponents),
    componentProperties: normalizeComponentProperties(
      readRecord(node, "componentProperties"),
      variables,
    ),
    componentPropertyReferences: normalizeSurfaceValue(
      readRecord(node, "componentPropertyReferences"),
      variables,
    ),
    componentDefinitions: normalizeComponentDefinitions(node, variables),
    variant,
    layout: normalizePickedRecord(node, layoutKeys, variables),
    constraints: normalizePickedRecord(
      readRecord(node, "constraints"),
      ["horizontal", "vertical"],
      variables,
    ),
    dimensions: normalizeDimensions(node),
    style: pruneSurfaceRecord({
      fills: normalizePaintList(node.fills, variables),
      strokes: normalizePaintList(node.strokes, variables),
      effects: normalizeEffects(node.effects, variables),
      opacity: readNumber(node, "opacity"),
      blendMode: readString(node, "blendMode"),
      strokeWeight: normalizeSurfaceValue(node.strokeWeight, variables),
      strokeAlign: readString(node, "strokeAlign"),
      strokeDashes: normalizeSurfaceValue(node.strokeDashes, variables),
      individualStrokeWeights: normalizeSurfaceValue(
        node.individualStrokeWeights,
        variables,
      ),
      cornerRadius: normalizeSurfaceValue(node.cornerRadius, variables),
      rectangleCornerRadii: normalizeSurfaceValue(
        node.rectangleCornerRadii,
        variables,
      ),
      cornerSmoothing: readNumber(node, "cornerSmoothing"),
    }),
    text: pruneSurfaceRecord({
      characters: readString(node, "characters"),
      style: normalizePickedRecord(readRecord(node, "style"), textStyleKeys),
    }),
    boundVariables: normalizeSurfaceValue(
      readRecord(node, "boundVariables"),
      variables,
    ),
    children,
  });
}

export function fingerprintContractSurface(
  tree: DocumentNode,
  variables?: VariableRegistry,
  teamComponents?: TeamComponentRegistry,
): string {
  return sha256Hex(
    stableStringify(normalizeSurfaceNode(tree, variables, teamComponents)),
  );
}

export function fingerprintContracts(
  visuals: Record<string, unknown>,
  geometry: Record<string, unknown>,
  meta: unknown,
  structureDsl: string,
): string {
  return sha256Hex(
    stableStringify({
      visuals,
      geometry,
      meta,
      structureDsl,
    }),
  );
}

export function variantAssetSlug(
  when: Record<string, string>,
  variantAxes: Record<string, string[]>,
): string {
  const orderedAxes = Object.keys(variantAxes).sort((left, right) => {
    if (left === "Size") {
      return 1;
    }
    if (right === "Size") {
      return -1;
    }
    return left.localeCompare(right);
  });
  const parts = orderedAxes
    .map((axis) => when[axis])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return parts.join("-");
}

export async function fingerprintAssetFiles(
  assetsDir: string,
  slugs: string[],
): Promise<Record<string, string>> {
  const fingerprints: Record<string, string> = {};

  for (const slug of slugs.sort()) {
    const absolutePath = path.join(assetsDir, `${slug}.svg`);
    const bytes = await readFile(absolutePath);
    fingerprints[slug] = sha256Hex(bytes);
  }

  return fingerprints;
}
