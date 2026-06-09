import { FigmaInspectError } from "./errors.js";
import type { FigmaComponentSet } from "./schemas.js";
import type { ComponentSetLookup } from "./types.js";

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
  nameIndex: Map<string, string>,
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

  const componentSetId = nameIndex.get(lookup.value);
  if (!componentSetId) {
    throw new FigmaInspectError(
      `No component set with name "${lookup.value}" found in node ${nodeId}.`,
    );
  }

  return componentSetId;
}
