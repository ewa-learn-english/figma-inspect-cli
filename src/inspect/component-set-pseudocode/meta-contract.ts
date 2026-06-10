import {
  isRecord,
  readArray,
  readChildren,
  readRecord,
  readString,
} from "../component-set-spec/figma-node.js";
import type {
  TeamComponentEntry,
  TeamComponentRegistry,
} from "../component-set-spec/team-component-registry.js";
import type { ComponentSetSpec } from "../component-set-spec/types.js";
import { FigmaInspectError } from "../errors.js";

export interface MetaContractContext {
  teamComponents?: TeamComponentRegistry;
}

export interface MetaContract {
  version: 1;
  component?: TeamComponentEntry;
  dependencies?: TeamComponentEntry[];
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

function addTeamDependency(
  seen: Map<string, TeamComponentEntry>,
  entry: TeamComponentEntry | undefined,
): void {
  if (!entry) {
    return;
  }

  seen.set(entry.id, entry);
}

function collectInstanceDependencies(
  node: Record<string, unknown>,
  teamComponents: TeamComponentRegistry,
  seen: Map<string, TeamComponentEntry>,
): void {
  if (readString(node, "type") === "INSTANCE") {
    const name = readString(node, "name");
    if (name) {
      addTeamDependency(seen, teamComponents.findByName(name));
    }
  }

  for (const child of readChildren(node)) {
    collectInstanceDependencies(child, teamComponents, seen);
  }
}

function resolveComponentEntry(
  spec: ComponentSetSpec,
  componentSetId: string,
  teamComponents: TeamComponentRegistry | undefined,
): TeamComponentEntry | undefined {
  if (!teamComponents) {
    return undefined;
  }

  return (
    teamComponents.findByName(spec.name) ??
    teamComponents.findById(componentSetId)
  );
}

function buildDependencies(
  componentSet: Record<string, unknown>,
  spec: ComponentSetSpec,
  teamComponents: TeamComponentRegistry | undefined,
  componentEntry: TeamComponentEntry | undefined,
): TeamComponentEntry[] | undefined {
  if (!teamComponents) {
    return undefined;
  }

  const seen = new Map<string, TeamComponentEntry>();
  const definitions = readRecord(componentSet, "componentPropertyDefinitions");

  if (definitions) {
    for (const rawDefinition of Object.values(definitions)) {
      if (!isRecord(rawDefinition)) {
        continue;
      }

      const swapSet = readSwapSet(rawDefinition);
      if (swapSet) {
        addTeamDependency(seen, teamComponents.findByKey(swapSet));
      }
    }
  }

  for (const definition of Object.values(spec.props)) {
    if (definition.type === "instance" && definition.swapSet) {
      addTeamDependency(seen, teamComponents.findByKey(definition.swapSet));
    }
  }

  collectInstanceDependencies(componentSet, teamComponents, seen);

  if (componentEntry) {
    seen.delete(componentEntry.id);
  }

  if (seen.size === 0) {
    return undefined;
  }

  return [...seen.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function buildMetaContract(
  componentSet: Record<string, unknown>,
  spec: ComponentSetSpec,
  context?: MetaContractContext,
): MetaContract {
  const componentSetId = readString(componentSet, "id");
  if (!componentSetId) {
    throw new FigmaInspectError("COMPONENT_SET is missing id.");
  }

  const component = resolveComponentEntry(
    spec,
    componentSetId,
    context?.teamComponents,
  );
  const dependencies = buildDependencies(
    componentSet,
    spec,
    context?.teamComponents,
    component,
  );

  return {
    version: 1,
    ...(component ? { component } : {}),
    ...(dependencies ? { dependencies } : {}),
  };
}
