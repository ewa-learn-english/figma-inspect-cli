import {
  isRecord,
  readArray,
  readBoolean,
  readRecord,
  readString,
} from "./figma-node.js";
import type { ComponentSetPropDefinition } from "./types.js";

export interface ParsedComponentSetProps {
  props: Record<string, ComponentSetPropDefinition>;
  propIdToName: Map<string, string>;
  baseVariant: Record<string, string>;
}

function toPropName(rawKey: string): string {
  const baseName = rawKey.split("#")[0] ?? rawKey;
  if (baseName.length === 0) {
    return rawKey;
  }

  return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

function readSwapSet(definition: Record<string, unknown>): string | undefined {
  const preferredValues = readArray(definition, "preferredValues");
  const first = preferredValues?.find(isRecord);
  if (!first) {
    return undefined;
  }

  const type = readString(first, "type");
  if (type !== "COMPONENT_SET" && type !== "COMPONENT") {
    return undefined;
  }

  return readString(first, "key");
}

function parseDefinition(
  definition: Record<string, unknown>,
): ComponentSetPropDefinition | undefined {
  const type = readString(definition, "type");
  if (!type) {
    return undefined;
  }

  switch (type) {
    case "BOOLEAN": {
      return {
        type: "boolean",
        default: readBoolean(definition, "defaultValue"),
      };
    }
    case "TEXT": {
      return {
        type: "text",
        default: readString(definition, "defaultValue"),
      };
    }
    case "INSTANCE_SWAP": {
      return {
        type: "instance",
        default: readString(definition, "defaultValue"),
        swapSet: readSwapSet(definition),
      };
    }
    case "VARIANT": {
      const options = readArray(definition, "variantOptions")
        ?.map((option) => (typeof option === "string" ? option : undefined))
        .filter((option): option is string => option !== undefined);

      return {
        type: "variant",
        default: readString(definition, "defaultValue"),
        options,
      };
    }
    default:
      return undefined;
  }
}

export function parseComponentSetProps(
  componentSet: Record<string, unknown>,
): ParsedComponentSetProps {
  const definitions = readRecord(componentSet, "componentPropertyDefinitions");
  const props: Record<string, ComponentSetPropDefinition> = {};
  const propIdToName = new Map<string, string>();
  const baseVariant: Record<string, string> = {};

  if (!definitions) {
    return { props, propIdToName, baseVariant };
  }

  for (const [rawKey, rawDefinition] of Object.entries(definitions)) {
    if (!isRecord(rawDefinition)) {
      continue;
    }

    const parsed = parseDefinition(rawDefinition);
    if (!parsed) {
      continue;
    }

    const propName = toPropName(rawKey);
    props[propName] = parsed;
    propIdToName.set(rawKey, propName);

    if (parsed.type === "variant" && typeof parsed.default === "string") {
      baseVariant[toPropName(rawKey.split("#")[0] ?? rawKey)] = parsed.default;
    }
  }

  return { props, propIdToName, baseVariant };
}

export function parseVariantName(name: string): Record<string, string> {
  const variants: Record<string, string> = {};

  for (const part of name.split(",")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key.length === 0 || value.length === 0) {
      continue;
    }

    variants[key.charAt(0).toLowerCase() + key.slice(1)] = value;
  }

  return variants;
}
