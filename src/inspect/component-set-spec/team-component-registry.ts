import { readFile } from "node:fs/promises";
import { FigmaInspectError } from "../errors.js";
import { isRecord, readString } from "./figma-node.js";

export interface TeamComponentEntry {
  id: string;
  key: string;
  name: string;
  file_key: string;
  project_id: string;
}

export class TeamComponentRegistry {
  private readonly byId = new Map<string, TeamComponentEntry>();
  private readonly byKey = new Map<string, TeamComponentEntry>();
  private readonly byName = new Map<string, TeamComponentEntry>();

  isKnownComponent(name: string | undefined, componentId?: string): boolean {
    if (name && this.byName.has(name)) {
      return true;
    }

    if (componentId && this.byId.has(componentId)) {
      return true;
    }

    return false;
  }

  findById(id: string): TeamComponentEntry | undefined {
    return this.byId.get(id);
  }

  findByKey(key: string): TeamComponentEntry | undefined {
    return this.byKey.get(key);
  }

  findByName(name: string): TeamComponentEntry | undefined {
    return this.byName.get(name);
  }

  static fromEntries(entries: TeamComponentEntry[]): TeamComponentRegistry {
    const registry = new TeamComponentRegistry();

    for (const entry of entries) {
      registry.byId.set(entry.id, entry);
      registry.byKey.set(entry.key, entry);
      registry.byName.set(entry.name, entry);
    }

    return registry;
  }
}

function parseTeamComponentEntry(
  value: unknown,
): TeamComponentEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value, "id");
  const key = readString(value, "key");
  const name = readString(value, "name");
  const file_key = readString(value, "file_key");
  const project_id = readString(value, "project_id");

  if (!id || !key || !name || !file_key || !project_id) {
    return undefined;
  }

  return {
    id,
    key,
    name,
    file_key,
    project_id,
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
