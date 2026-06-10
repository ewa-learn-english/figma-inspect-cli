import type { SlimNode } from "./types.js";

export type FigmaNode = Record<string, unknown>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRef(value: unknown): value is { $ref: string } {
  return isRecord(value) && typeof value.$ref === "string";
}

export function isVar(value: unknown): value is { $var: string } {
  return isRecord(value) && typeof value.$var === "string";
}

export function isSlimNode(value: unknown): value is SlimNode {
  return isRecord(value) && typeof value.type === "string";
}

export function readString(
  node: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = node[key];
  return typeof value === "string" ? value : undefined;
}

export function readNumber(
  node: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = node[key];
  return typeof value === "number" ? value : undefined;
}

export function readBoolean(
  node: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = node[key];
  return typeof value === "boolean" ? value : undefined;
}

export function readArray(
  node: Record<string, unknown>,
  key: string,
): unknown[] | undefined {
  const value = node[key];
  return Array.isArray(value) ? value : undefined;
}

export function readRecord(
  node: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = node[key];
  return isRecord(value) ? value : undefined;
}

export function readChildren(node: Record<string, unknown>): FigmaNode[] {
  const children = readArray(node, "children");
  if (!children) {
    return [];
  }

  return children.filter(isRecord);
}
