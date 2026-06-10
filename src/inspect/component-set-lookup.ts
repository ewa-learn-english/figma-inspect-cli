import { FigmaInspectError } from "./errors.js";
import type { FigmaComponentSet } from "./schemas.js";
import type { ComponentSetLookup } from "./types.js";

export function buildLenientNameIndex(
  componentSets: Record<string, FigmaComponentSet>,
): Map<string, string> {
  const index = new Map<string, string>();

  for (const [id, entry] of Object.entries(componentSets)) {
    if (!index.has(entry.name)) {
      index.set(entry.name, id);
    }
  }

  return index;
}

export function indexComponentSetsByName(
  componentSets: Record<string, FigmaComponentSet>,
): Map<string, string> {
  const index = new Map<string, string>();

  for (const [id, entry] of Object.entries(componentSets)) {
    const existingId = index.get(entry.name);
    if (existingId !== undefined) {
      throw new FigmaInspectError(
        `Multiple component sets named "${entry.name}" found: ${existingId}, ${id}. Use --component-set-key instead.`,
      );
    }

    index.set(entry.name, id);
  }

  return index;
}

export function resolveComponentSetId(
  componentSets: Record<string, FigmaComponentSet>,
  lookup: ComponentSetLookup,
  nodeId: string,
): string {
  if (lookup.kind === "key") {
    for (const [id, entry] of Object.entries(componentSets)) {
      if (entry.key === lookup.value) {
        return id;
      }
    }

    throw new FigmaInspectError(
      `No component set with key ${lookup.value} found in node ${nodeId}.`,
    );
  }

  const matches = Object.entries(componentSets).filter(
    ([, entry]) => entry.name === lookup.value,
  );

  if (matches.length === 0) {
    throw new FigmaInspectError(
      `No component set with name "${lookup.value}" found in node ${nodeId}.`,
    );
  }

  if (matches.length > 1) {
    throw new FigmaInspectError(
      `Multiple component sets named "${lookup.value}" found: ${matches.map(([id]) => id).join(", ")}. Use --component-set-key instead.`,
    );
  }

  return matches[0][0];
}
