import type { SlimNode } from "../component-set-spec/types.js";
import type { VariableRegistry } from "../component-set-spec/variable-registry.js";

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

export function resolveSlimNodeTokens(
  node: SlimNode,
  registry: VariableRegistry,
): SlimNode {
  return resolveValue(node, registry) as SlimNode;
}
