import { isRecord } from "../component-set-spec/figma-node.js";
import { normalizePropName } from "../component-set-spec/prop-name.js";
import type { SlimNode } from "../component-set-spec/types.js";

export { isRecord };

export function isRef(value: unknown): value is { $ref: string } {
  return isRecord(value) && typeof value.$ref === "string";
}

export function isVar(value: unknown): value is { $var: string } {
  return isRecord(value) && typeof value.$var === "string";
}

export function isNode(value: unknown): value is SlimNode {
  return isRecord(value) && typeof value.type === "string";
}

export function nodeKey(
  node: SlimNode,
  options: { root?: boolean } = {},
): string {
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
