import { instanceSlotKey } from "../component-set-spec/extract-slots.js";
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
import type {
  ComponentSetPropDefinition,
  ComponentSetSpec,
} from "../component-set-spec/types.js";
import { FigmaInspectError } from "../errors.js";

export interface MetaContractContext {
  teamComponents?: TeamComponentRegistry;
  component?: TeamComponentEntry;
}

interface MetaContractProp {
  type: ComponentSetPropDefinition["type"];
  default?: boolean | string;
  options?: string[];
}

interface MetaContractSlot {
  kind: "swap" | "nested";
  component: string;
}

export interface MetaContract {
  version: 1;
  component?: TeamComponentEntry;
  props?: Record<string, MetaContractProp>;
  slots?: Record<string, MetaContractSlot>;
  dependencies?: TeamComponentEntry[];
}

function readPublishedComponentSetKey(
  definition: Record<string, unknown>,
): string | undefined {
  const preferredValues = readArray(definition, "preferredValues");
  const first = preferredValues?.find(isRecord);
  if (!first) {
    return undefined;
  }

  if (readString(first, "type") !== "COMPONENT_SET") {
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

function collectPublishedComponentSetDependencies(
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
    collectPublishedComponentSetDependencies(child, teamComponents, seen);
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

function buildProps(
  spec: ComponentSetSpec,
): Record<string, MetaContractProp> | undefined {
  const props: Record<string, MetaContractProp> = {};

  for (const [name, definition] of Object.entries(spec.props)) {
    const entry: MetaContractProp = { type: definition.type };

    if (definition.type === "instance") {
      entry.default = name;
    } else if (definition.default !== undefined) {
      entry.default = definition.default;
    }

    if (definition.type === "variant" && definition.options) {
      entry.options = [...definition.options];
    }

    props[name] = entry;
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

function collectNestedInstanceSlots(
  node: Record<string, unknown>,
  slots: Record<string, MetaContractSlot>,
  swapSlotKeys: ReadonlySet<string>,
): void {
  if (readString(node, "type") === "INSTANCE") {
    const name = readString(node, "name");
    if (name) {
      const slotKey = instanceSlotKey(name);
      if (!swapSlotKeys.has(slotKey) && !slots[slotKey]) {
        slots[slotKey] = {
          kind: "nested",
          component: name,
        };
      }
    }
  }

  for (const child of readChildren(node)) {
    collectNestedInstanceSlots(child, slots, swapSlotKeys);
  }
}

function buildSlots(
  componentSet: Record<string, unknown>,
  spec: ComponentSetSpec,
): Record<string, MetaContractSlot> | undefined {
  const slots: Record<string, MetaContractSlot> = {};

  for (const [name, definition] of Object.entries(spec.props)) {
    if (definition.type === "instance") {
      slots[name] = {
        kind: "swap",
        component: name,
      };
    }
  }

  const swapSlotKeys = new Set(Object.keys(slots));

  for (const variant of readChildren(componentSet)) {
    if (readString(variant, "type") !== "COMPONENT") {
      continue;
    }

    collectNestedInstanceSlots(variant, slots, swapSlotKeys);
  }

  return Object.keys(slots).length > 0 ? slots : undefined;
}

function buildDependencies(
  componentSet: Record<string, unknown>,
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

      const componentSetKey = readPublishedComponentSetKey(rawDefinition);
      if (componentSetKey) {
        addTeamDependency(seen, teamComponents.findByKey(componentSetKey));
      }
    }
  }

  collectPublishedComponentSetDependencies(componentSet, teamComponents, seen);

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

  const component =
    context?.component ??
    resolveComponentEntry(spec, componentSetId, context?.teamComponents);
  const props = buildProps(spec);
  const slots = buildSlots(componentSet, spec);
  const dependencies = buildDependencies(
    componentSet,
    context?.teamComponents,
    component,
  );

  return {
    version: 1,
    ...(component ? { component } : {}),
    ...(props ? { props } : {}),
    ...(slots ? { slots } : {}),
    ...(dependencies ? { dependencies } : {}),
  };
}
