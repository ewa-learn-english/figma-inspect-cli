import {
  type ComponentSetContext,
  componentSetContextFromNodeEntry,
  loadComponentSetContext,
} from "./component-set-context.js";
import {
  type TeamComponentEntry,
  TeamComponentRegistry,
} from "./component-set-spec/team-component-registry.js";
import { FigmaInspectError } from "./errors.js";
import { fetchFileNodeEntry } from "./fetch-file-node-entry.js";
import { resolveTeamComponentSetScope } from "./resolve-team-component-set.js";
import type { FileNodeEntry } from "./schemas.js";
import type { ComponentSetTarget } from "./types.js";

export async function resolveComponentSetExportContext(options: {
  token: string;
  teamId?: string;
  componentSet: ComponentSetTarget;
  entry?: FileNodeEntry;
}): Promise<{
  fileKey: string;
  component: TeamComponentEntry;
  teamComponents: TeamComponentRegistry;
  context: ComponentSetContext;
}> {
  const target = options.componentSet;
  if (target.kind !== "node") {
    if (!options.teamId) {
      throw new FigmaInspectError(
        "Select a Figma team to find a component set by name or key.",
      );
    }
    const scope = await resolveTeamComponentSetScope({
      ...options,
      teamId: options.teamId,
    });
    return {
      fileKey: scope.fileKey,
      component: {
        id: scope.publishedSet.id,
        key: scope.publishedSet.key,
        name: scope.publishedSet.name,
        fileKey: scope.fileKey,
        projectId: scope.publishedSet.projectId,
      },
      teamComponents: scope.teamComponents,
      context: await loadComponentSetContext({
        token: options.token,
        ...scope,
      }),
    };
  }
  const entry =
    options.entry ??
    (await fetchFileNodeEntry({ token: options.token, ...target }));
  const node = entry.document;
  if (node?.type !== "COMPONENT_SET") {
    throw new FigmaInspectError(
      `Figma node ${target.nodeId} is ${node?.type ?? "UNKNOWN"}; expected COMPONENT_SET.`,
    );
  }
  const metadata = entry.componentSets[target.nodeId];
  if (!metadata) {
    throw new FigmaInspectError(
      `Component set ${target.nodeId} has no component-set metadata.`,
    );
  }
  return {
    fileKey: target.fileKey,
    component: { ...metadata, fileKey: target.fileKey },
    teamComponents: TeamComponentRegistry.fromEntries(
      Object.values(entry.componentSets),
    ),
    context: componentSetContextFromNodeEntry(entry, node),
  };
}
