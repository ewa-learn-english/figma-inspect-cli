import { loadComponentSetContext } from "./get-node-component-set.js";
import type {
  ComponentEntry,
  DocumentNode,
  FigmaComponentSet,
} from "./schemas.js";
import type {
  ComponentSetScopeOptions,
  FigmaComponentSetProperty,
} from "./types.js";

function buildComponentSetNameIndex(
  componentSets: Record<string, FigmaComponentSet>,
): Map<string, string> {
  const index = new Map<string, string>();

  for (const [id, entry] of Object.entries(componentSets)) {
    index.set(entry.name, id);
  }

  return index;
}

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

  const isExposedInstance = root.isExposedInstance === true;

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

  if (!Array.isArray(root.children)) {
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
  const { tree, componentSets, components } =
    await loadComponentSetContext(options);
  const seen = new Map<string, FigmaComponentSetProperty>();
  collectNestedComponents(
    tree,
    buildComponentSetNameIndex(componentSets),
    componentSets,
    components,
    seen,
  );

  return [...seen.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
