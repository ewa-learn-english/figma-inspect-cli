import { readFile } from "node:fs/promises";
import { FigmaInspectError } from "../errors.js";
import { isRecord, readChildren, readString } from "./figma-node.js";
import { parseComponentSetProps, parseVariantName } from "./parse-props.js";
import { resolveSpecTokens } from "./resolve-tokens.js";
import { diffFlatMaps, flattenSlimNode, slimNode } from "./slim-node.js";
import type { ComponentSetSpec, VariantPatch } from "./types.js";
import {
  loadVariableRegistry,
  type VariableRegistry,
} from "./variable-registry.js";

export interface BuildComponentSetSpecOptions {
  variablesPath?: string;
}

function variantsMatch(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  return Object.entries(left).every(([key, value]) => right[key] === value);
}

function pickBaseVariantNode(
  children: Record<string, unknown>[],
  baseVariant: Record<string, string>,
): Record<string, unknown> | undefined {
  if (children.length === 0) {
    return undefined;
  }

  if (Object.keys(baseVariant).length > 0) {
    const matched = children.find((child) => {
      const name = readString(child, "name");
      if (!name) {
        return false;
      }

      return variantsMatch(baseVariant, parseVariantName(name));
    });

    if (matched) {
      return matched;
    }
  }

  return children[0];
}

function buildVariantPatches(
  variants: Record<string, string>[],
  baseVariant: Record<string, string>,
  baseFlat: Map<string, unknown>,
  variantTrees: Map<string, Map<string, unknown>>,
): VariantPatch[] {
  const patches: VariantPatch[] = [];

  for (const variant of variants) {
    if (
      Object.keys(baseVariant).length > 0 &&
      variantsMatch(baseVariant, variant)
    ) {
      continue;
    }

    const key = JSON.stringify(variant);
    const flat = variantTrees.get(key);
    if (!flat) {
      continue;
    }

    const changes = diffFlatMaps(baseFlat, flat);
    if (Object.keys(changes).length === 0) {
      continue;
    }

    patches.push({ when: variant, changes });
  }

  return patches;
}

async function readComponentSetFile(
  inputPath: string,
): Promise<Record<string, unknown>> {
  let rawText: string;
  try {
    rawText = await readFile(inputPath, "utf8");
  } catch {
    throw new FigmaInspectError(`Cannot read input file: ${inputPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new FigmaInspectError(`Invalid JSON in input file: ${inputPath}`);
  }

  if (!isRecord(parsed)) {
    throw new FigmaInspectError("Input JSON must be an object.");
  }

  if (readString(parsed, "type") !== "COMPONENT_SET") {
    throw new FigmaInspectError(
      "Input JSON root must be a COMPONENT_SET node.",
    );
  }

  return parsed;
}

function buildComponentSetSpec(
  componentSet: Record<string, unknown>,
  registry?: VariableRegistry,
): ComponentSetSpec {
  const name = readString(componentSet, "name") ?? "ComponentSet";
  const { props, propIdToName, baseVariant } =
    parseComponentSetProps(componentSet);
  const variantNodes = readChildren(componentSet).filter(
    (child) => readString(child, "type") === "COMPONENT",
  );

  if (variantNodes.length === 0) {
    throw new FigmaInspectError("COMPONENT_SET has no variant components.");
  }

  const variants = variantNodes
    .map((node) => {
      const variantName = readString(node, "name");
      return variantName ? parseVariantName(variantName) : {};
    })
    .filter((variant) => Object.keys(variant).length > 0);

  const baseNode = pickBaseVariantNode(variantNodes, baseVariant);
  if (!baseNode) {
    throw new FigmaInspectError("Cannot determine base variant component.");
  }

  const baseName = readString(baseNode, "name");
  const resolvedBaseVariant =
    baseName !== undefined && Object.keys(baseVariant).length === 0
      ? parseVariantName(baseName)
      : baseVariant;

  const layout = slimNode(baseNode, propIdToName);
  if (!layout) {
    throw new FigmaInspectError(
      "Failed to build layout tree from base variant.",
    );
  }

  const baseFlat = flattenSlimNode(layout);
  const variantTrees = new Map<string, Map<string, unknown>>();

  for (const variantNode of variantNodes) {
    const variantName = readString(variantNode, "name");
    if (!variantName) {
      continue;
    }

    const variant = parseVariantName(variantName);
    const tree = slimNode(variantNode, propIdToName);
    if (!tree) {
      continue;
    }

    variantTrees.set(JSON.stringify(variant), flattenSlimNode(tree));
  }

  const variantPatches = buildVariantPatches(
    variants,
    resolvedBaseVariant,
    baseFlat,
    variantTrees,
  );

  const spec: ComponentSetSpec = {
    name,
    props,
    baseVariant: resolvedBaseVariant,
    variants,
    layout,
    variantPatches,
  };

  return registry ? resolveSpecTokens(spec, registry) : spec;
}

export async function buildComponentSetSpecFromFile(
  inputPath: string,
  options: BuildComponentSetSpecOptions = {},
): Promise<ComponentSetSpec> {
  const componentSet = await readComponentSetFile(inputPath);
  const registry = options.variablesPath
    ? await loadVariableRegistry(options.variablesPath)
    : undefined;

  return buildComponentSetSpec(componentSet, registry);
}
