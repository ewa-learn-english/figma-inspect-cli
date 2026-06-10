import type { ComponentSetPropDefinition } from "./types.js";

export function rawPropKey(rawKey: string): string {
  return rawKey.split("#")[0] ?? rawKey;
}

export function normalizePropName(raw: string): string {
  const base = rawPropKey(raw);
  const words = base
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

export function resolvePropName(
  rawKey: string,
  type: ComponentSetPropDefinition["type"],
): string {
  if (type === "variant") {
    return rawPropKey(rawKey);
  }

  return normalizePropName(rawKey);
}
