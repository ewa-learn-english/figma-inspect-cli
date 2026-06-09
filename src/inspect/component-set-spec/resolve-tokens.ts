import type {
  ComponentSetSpec,
  ComponentSetVariant,
  SlimNode,
} from "./types.js";
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

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const resolved = resolveVariableField(
    value as Record<string, unknown>,
    registry,
  );
  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(resolved)) {
    output[key] = resolveValue(entry, registry);
  }

  return output;
}

function resolveNode(node: SlimNode, registry: VariableRegistry): SlimNode {
  return resolveValue(node, registry) as SlimNode;
}

function resolveVariant(
  variant: ComponentSetVariant,
  registry: VariableRegistry,
): ComponentSetVariant {
  return {
    when: variant.when,
    layout: resolveNode(variant.layout, registry),
  };
}

export function resolveSpecTokens(
  spec: ComponentSetSpec,
  registry: VariableRegistry,
): ComponentSetSpec {
  return {
    ...spec,
    variants: spec.variants.map((variant) => resolveVariant(variant, registry)),
  };
}
