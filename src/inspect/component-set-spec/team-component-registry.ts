import { readFile } from "node:fs/promises";
import { FigmaInspectError } from "../errors.js";
import { isRecord, readString } from "./figma-node.js";

export class TeamComponentRegistry {
  private readonly names = new Set<string>();
  private readonly ids = new Set<string>();
  private readonly keys = new Set<string>();

  isKnownComponent(name: string | undefined, componentId?: string): boolean {
    if (name && this.names.has(name)) {
      return true;
    }

    if (componentId && this.ids.has(componentId)) {
      return true;
    }

    return false;
  }

  static fromEntries(entries: TeamComponentEntry[]): TeamComponentRegistry {
    const registry = new TeamComponentRegistry();

    for (const entry of entries) {
      registry.names.add(entry.name);
      if (entry.id) {
        registry.ids.add(entry.id);
      }
      if (entry.key) {
        registry.keys.add(entry.key);
      }
    }

    return registry;
  }
}

export interface TeamComponentEntry {
  name: string;
  id?: string;
  key?: string;
}

function parseTeamComponentEntry(
  value: unknown,
): TeamComponentEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = readString(value, "name");
  if (!name) {
    return undefined;
  }

  return {
    name,
    id: readString(value, "id"),
    key: readString(value, "key"),
  };
}

function parseTeamComponentEntries(payload: unknown): TeamComponentEntry[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => parseTeamComponentEntry(entry))
      .filter((entry): entry is TeamComponentEntry => entry !== undefined);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const fromItems = payload.items;
  if (Array.isArray(fromItems)) {
    return parseTeamComponentEntries(fromItems);
  }

  const fromComponentSets = payload.componentSets;
  if (Array.isArray(fromComponentSets)) {
    return parseTeamComponentEntries(fromComponentSets);
  }

  return [];
}

export async function loadTeamComponentRegistry(
  teamComponentsPath: string,
): Promise<TeamComponentRegistry> {
  let rawText: string;
  try {
    rawText = await readFile(teamComponentsPath, "utf8");
  } catch {
    throw new FigmaInspectError(
      `Cannot read team components file: ${teamComponentsPath}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new FigmaInspectError(
      `Invalid JSON in team components file: ${teamComponentsPath}`,
    );
  }

  const entries = parseTeamComponentEntries(parsed);
  if (entries.length === 0) {
    throw new FigmaInspectError(
      "Team components JSON does not contain component entries.",
    );
  }

  return TeamComponentRegistry.fromEntries(entries);
}
