import { TeamComponentRegistry } from "./component-set-spec/team-component-registry.js";
import { FigmaInspectError } from "./errors.js";
import { listAllComponentSets } from "./list-all-component-sets.js";
import type {
  ComponentSetLookup,
  ComponentSetScopeOptions,
  FigmaTeamComponentSet,
} from "./types.js";

export interface ResolveTeamComponentSetScopeResult
  extends Pick<
    ComponentSetScopeOptions,
    "fileKey" | "nodeId" | "componentSet"
  > {
  publishedSet: FigmaTeamComponentSet;
  teamComponents: TeamComponentRegistry;
}

function teamComponentRegistryFromPublishedSets(
  publishedSets: FigmaTeamComponentSet[],
): TeamComponentRegistry {
  return TeamComponentRegistry.fromEntries(
    publishedSets.map((set) => ({
      id: set.id,
      key: set.key,
      name: set.name,
      fileKey: set.fileKey,
      projectId: set.projectId,
    })),
  );
}

export interface ResolveTeamComponentSetOptions {
  token: string;
  teamId: string;
  componentSet: ComponentSetLookup;
  fetchImpl?: typeof fetch;
}

function matchesLookup(
  componentSet: FigmaTeamComponentSet,
  lookup: ComponentSetLookup,
): boolean {
  return lookup.kind === "name"
    ? componentSet.name === lookup.value
    : componentSet.key === lookup.value;
}

function formatTeamComponentSetLocation(
  componentSet: FigmaTeamComponentSet,
): string {
  return `${componentSet.name} (${componentSet.fileName}, ${componentSet.projectName})`;
}

export async function resolveTeamComponentSetScope({
  token,
  teamId,
  componentSet,
  fetchImpl,
}: ResolveTeamComponentSetOptions): Promise<ResolveTeamComponentSetScopeResult> {
  const publishedSets = await listAllComponentSets({
    token,
    teamId,
    fetchImpl,
  });
  const matches = publishedSets.filter((entry) =>
    matchesLookup(entry, componentSet),
  );

  if (matches.length === 0) {
    const label =
      componentSet.kind === "name"
        ? `name "${componentSet.value}"`
        : `key ${componentSet.value}`;
    throw new FigmaInspectError(
      `No published component set with ${label} found in team.`,
    );
  }

  if (matches.length > 1) {
    const locations = matches.map(formatTeamComponentSetLocation).join("; ");
    throw new FigmaInspectError(
      `Multiple published component sets match: ${locations}. Use --inspect-component-set with --file-key and --node-id.`,
    );
  }

  const match = matches[0];

  return {
    fileKey: match.fileKey,
    nodeId: match.id,
    componentSet,
    publishedSet: match,
    teamComponents: teamComponentRegistryFromPublishedSets(publishedSets),
  };
}
