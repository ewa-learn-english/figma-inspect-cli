import {
  type ComponentSetContext,
  loadComponentSetContext,
  loadComponentSetContextByNodeRef,
} from "./component-set-context.js";
import type {
  ComponentEntry,
  DocumentNode,
  FigmaComponentSet,
} from "./schemas.js";
import type {
  ComponentSetNodeRefOptions,
  ComponentSetScopeOptions,
  FigmaComponentSetProperty,
} from "./types.js";

function addNestedComponent(
  seen: Map<string, FigmaComponentSetProperty>,
  nested: FigmaComponentSetProperty,
): void {
  const existing = seen.get(nested.id);
  if (!existing) {
    seen.set(nested.id, nested);
    return;
  }

  if (nested.isExposedInstance) {
    existing.isExposedInstance = true;
  }
}

function resolveNestedComponentFromInstance(
  root: DocumentNode,
  componentSetIdsByName: Map<string, string>,
  componentSets: Record<string, FigmaComponentSet>,
  components: Record<string, ComponentEntry>,
): FigmaComponentSetProperty | undefined {
  if (root.type !== "INSTANCE" || !root.name) {
    return undefined;
  }

  const isExposedInstance = root.isExposedInstance;

  if (isExposedInstance) {
    const componentSetId = componentSetIdsByName.get(root.name);
    if (componentSetId) {
      return { id: componentSetId, name: root.name, isExposedInstance };
    }
  }

  if (!root.componentId) {
    return undefined;
  }

  const component = components[root.componentId];
  if (!component) {
    return undefined;
  }

  if (component.componentSetId) {
    const componentSet = componentSets[component.componentSetId];
    if (componentSet !== undefined && componentSet.name === root.name) {
      return {
        id: component.componentSetId,
        name: componentSet.name,
        isExposedInstance,
      };
    }

    return undefined;
  }

  if (component.name && component.name === root.name) {
    return {
      id: root.componentId,
      name: component.name,
      isExposedInstance,
    };
  }

  return undefined;
}

function collectNestedComponents(
  root: DocumentNode,
  componentSetIdsByName: Map<string, string>,
  componentSets: Record<string, FigmaComponentSet>,
  components: Record<string, ComponentEntry>,
  seen: Map<string, FigmaComponentSetProperty>,
): void {
  const nested = resolveNestedComponentFromInstance(
    root,
    componentSetIdsByName,
    componentSets,
    components,
  );

  if (nested) {
    addNestedComponent(seen, nested);
  }

  if (!root.children) {
    return;
  }

  for (const child of root.children) {
    collectNestedComponents(
      child,
      componentSetIdsByName,
      componentSets,
      components,
      seen,
    );
  }
}

export async function listComponentSetProperties(
  options: ComponentSetScopeOptions,
): Promise<FigmaComponentSetProperty[]> {
  return listComponentSetPropertiesFromContext(
    await loadComponentSetContext(options),
  );
}

export async function listComponentSetPropertiesByRef(
  options: ComponentSetNodeRefOptions,
): Promise<FigmaComponentSetProperty[]> {
  return listComponentSetPropertiesFromContext(
    await loadComponentSetContextByNodeRef(options),
  );
}

function listComponentSetPropertiesFromContext({
  tree,
  componentSets,
  components,
  nameIndex,
}: ComponentSetContext): FigmaComponentSetProperty[] {
  const seen = new Map<string, FigmaComponentSetProperty>();
  collectNestedComponents(tree, nameIndex, componentSets, components, seen);

  return [...seen.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
