import { TeamComponentRegistry } from "./component-set-spec/team-component-registry.js";
import { FigmaInspectError } from "./errors.js";
import { fetchFileNodeEntry } from "./fetch-file-node-entry.js";
import { listAllComponentSets } from "./list-all-component-sets.js";
import type {
  ComponentSetLookup,
  ComponentSetScopeOptions,
  ComponentSetTarget,
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
  componentSet: ComponentSetTarget;
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

async function assertComponentSetNodeTarget({
  token,
  componentSet,
  fetchImpl,
}: Pick<
  ResolveTeamComponentSetOptions,
  "token" | "componentSet" | "fetchImpl"
>): Promise<void> {
  if (componentSet.kind !== "node") {
    return;
  }

  const nodeEntry = await fetchFileNodeEntry({
    token,
    fileKey: componentSet.fileKey,
    nodeId: componentSet.nodeId,
    fetchImpl,
  });
  if (nodeEntry.document?.type !== "COMPONENT_SET") {
    const type = nodeEntry.document?.type ?? "UNKNOWN";
    throw new FigmaInspectError(
      `Figma node ${componentSet.nodeId} is ${type}; expected COMPONENT_SET.`,
    );
  }
}

function matchesTarget(
  componentSet: FigmaTeamComponentSet,
  target: ComponentSetTarget,
): boolean {
  if (target.kind === "node") {
    return (
      componentSet.fileKey === target.fileKey &&
      componentSet.id === target.nodeId
    );
  }

  return matchesLookup(componentSet, target);
}

function targetLabel(componentSet: ComponentSetTarget): string {
  if (componentSet.kind === "name") {
    return `name "${componentSet.value}"`;
  }

  if (componentSet.kind === "key") {
    return `key ${componentSet.value}`;
  }

  return `node ${componentSet.nodeId} in file ${componentSet.fileKey}`;
}

export async function resolveTeamComponentSetScope({
  token,
  teamId,
  componentSet,
  fetchImpl,
}: ResolveTeamComponentSetOptions): Promise<ResolveTeamComponentSetScopeResult> {
  await assertComponentSetNodeTarget({ token, componentSet, fetchImpl });

  const publishedSets = await listAllComponentSets({
    token,
    teamId,
    fetchImpl,
  });
  const matches = publishedSets.filter((entry) =>
    matchesTarget(entry, componentSet),
  );

  if (matches.length === 0) {
    throw new FigmaInspectError(
      `No published component set with ${targetLabel(componentSet)} found in team.`,
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
    componentSet: { kind: "key", value: match.key },
    publishedSet: match,
    teamComponents: teamComponentRegistryFromPublishedSets(publishedSets),
  };
}
