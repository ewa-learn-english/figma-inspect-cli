import { isRecord } from "./figma-node.js";
import type { ComponentSetSpec, SlimNode, VariantPatch } from "./types.js";
import type { VariableRegistry } from "./variable-registry.js";

function resolveVariableField(
  value: Record<string, unknown>,
  registry: VariableRegistry,
): Record<string, unknown> {
  const variable = value.variable;
  if (typeof variable !== "string") {
    return value;
  }

  const token = registry.resolve(variable);
  if (!token) {
    return value;
  }

  const { variable: _removed, ...rest } = value;
  return { ...rest, token };
}

function resolveValue(value: unknown, registry: VariableRegistry): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => resolveValue(entry, registry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const resolved = resolveVariableField(value, registry);
  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(resolved)) {
    output[key] = resolveValue(entry, registry);
  }

  return output;
}

function resolveNode(node: SlimNode, registry: VariableRegistry): SlimNode {
  return resolveValue(node, registry) as SlimNode;
}

function resolvePatchChanges(
  changes: Record<string, unknown>,
  registry: VariableRegistry,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(changes)) {
    if (key.endsWith(".variable") && typeof value === "string") {
      const token = registry.resolve(value);
      if (token) {
        resolved[key.replace(/\.variable$/, ".token")] = token;
        continue;
      }
    }

    resolved[key] = value;
  }

  return resolved;
}

function resolvePatch(
  patch: VariantPatch,
  registry: VariableRegistry,
): VariantPatch {
  return {
    when: patch.when,
    changes: resolvePatchChanges(patch.changes, registry),
  };
}

export function resolveSpecTokens(
  spec: ComponentSetSpec,
  registry: VariableRegistry,
): ComponentSetSpec {
  return {
    ...spec,
    layout: resolveNode(spec.layout, registry),
    variantPatches: spec.variantPatches.map((patch) =>
      resolvePatch(patch, registry),
    ),
  };
}
