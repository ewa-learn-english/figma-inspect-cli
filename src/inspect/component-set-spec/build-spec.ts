import { readFile } from "node:fs/promises";
import { FigmaInspectError } from "../errors.js";
import { compactSpec } from "./compact-spec.js";
import { isRecord, readChildren, readString } from "./figma-node.js";
import { parseComponentSetProps, parseVariantName } from "./parse-props.js";
import { resolveSpecTokens } from "./resolve-tokens.js";
import type { SlimContext } from "./slim-context.js";
import { slimNode } from "./slim-node.js";
import {
  loadTeamComponentRegistry,
  type TeamComponentRegistry,
} from "./team-component-registry.js";
import type { ComponentSetSpec, ComponentSetVariant } from "./types.js";
import {
  loadVariableRegistry,
  type VariableRegistry,
} from "./variable-registry.js";
import { collectVariantAxes } from "./variant-axes.js";

export interface BuildComponentSetSpecOptions {
  variablesPath?: string;
  teamComponentsPath?: string;
}

function sortVariants(variants: ComponentSetVariant[]): ComponentSetVariant[] {
  return [...variants].sort((left, right) =>
    JSON.stringify(left.when).localeCompare(JSON.stringify(right.when)),
  );
}

function buildVariants(
  allVariants: Record<string, string>[],
  variantTrees: Map<string, ComponentSetVariant["layout"]>,
): ComponentSetVariant[] {
  const variants: ComponentSetVariant[] = [];

  for (const when of allVariants) {
    const tree = variantTrees.get(JSON.stringify(when));
    if (!tree) {
      continue;
    }

    variants.push({ when, layout: tree });
  }

  return sortVariants(variants);
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
  teamComponents?: TeamComponentRegistry,
): ComponentSetSpec {
  const name = readString(componentSet, "name") ?? "ComponentSet";
  const { props, propIdToName, baseVariant } =
    parseComponentSetProps(componentSet);
  const slimContext: SlimContext = { propIdToName, teamComponents };
  const variantNodes = readChildren(componentSet).filter(
    (child) => readString(child, "type") === "COMPONENT",
  );

  if (variantNodes.length === 0) {
    throw new FigmaInspectError("COMPONENT_SET has no variant components.");
  }

  const allVariants = variantNodes
    .map((node) => {
      const variantName = readString(node, "name");
      return variantName ? parseVariantName(variantName) : {};
    })
    .filter((variant) => Object.keys(variant).length > 0);

  const variantTrees = new Map<string, ComponentSetVariant["layout"]>();

  for (const variantNode of variantNodes) {
    const variantName = readString(variantNode, "name");
    if (!variantName) {
      continue;
    }

    const variant = parseVariantName(variantName);
    const tree = slimNode(variantNode, slimContext);
    if (!tree) {
      continue;
    }

    variantTrees.set(JSON.stringify(variant), tree);
  }

  const variants = buildVariants(allVariants, variantTrees);
  if (variants.length === 0) {
    throw new FigmaInspectError("Failed to build variant layout trees.");
  }

  const spec: ComponentSetSpec = {
    name,
    props,
    baseVariant,
    variantAxes: collectVariantAxes(allVariants),
    variants,
  };

  const resolved = registry ? resolveSpecTokens(spec, registry) : spec;
  return compactSpec(resolved);
}

export async function buildComponentSetSpecFromFile(
  inputPath: string,
  options: BuildComponentSetSpecOptions = {},
): Promise<ComponentSetSpec> {
  const componentSet = await readComponentSetFile(inputPath);
  const registry = options.variablesPath
    ? await loadVariableRegistry(options.variablesPath)
    : undefined;
  const teamComponents = options.teamComponentsPath
    ? await loadTeamComponentRegistry(options.teamComponentsPath)
    : undefined;

  return buildComponentSetSpec(componentSet, registry, teamComponents);
}
