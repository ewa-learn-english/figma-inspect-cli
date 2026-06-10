import {
  type FigmaNode,
  isRecord,
  readChildren,
  readRecord,
  readString,
} from "./figma-node.js";
import type { TeamComponentRegistry } from "./team-component-registry.js";

export function instanceSlotKey(rawName: string): string {
  if (rawName.endsWith("Icon")) {
    return "icon";
  }

  return rawName.charAt(0).toLowerCase() + rawName.slice(1);
}

function readComponentProperties(
  node: FigmaNode,
): Record<string, string> | undefined {
  const raw = readRecord(node, "componentProperties");
  if (!raw) {
    return undefined;
  }

  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      continue;
    }

    const propValue = readString(value, "value");
    if (propValue) {
      props[instanceSlotKey(key)] = propValue;
    }
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

function collectNestedInstanceSlots(
  node: FigmaNode,
  registry: TeamComponentRegistry | undefined,
  slots: Record<string, string>,
): void {
  for (const child of readChildren(node)) {
    if (readString(child, "type") !== "INSTANCE") {
      collectNestedInstanceSlots(child, registry, slots);
      continue;
    }

    const instanceName = readString(child, "name");
    const componentId = readString(child, "componentId");
    if (!instanceName) {
      collectNestedInstanceSlots(child, registry, slots);
      continue;
    }

    const slotKey = instanceSlotKey(instanceName);
    if (!slots[slotKey]) {
      slots[slotKey] = instanceName;
    }

    if (
      instanceName.endsWith("Icon") ||
      registry?.isKnownComponent(instanceName, componentId)
    ) {
      continue;
    }

    collectNestedInstanceSlots(child, registry, slots);
  }
}

export function extractInstanceSlots(
  node: FigmaNode,
  registry: TeamComponentRegistry | undefined,
): Record<string, string> | undefined {
  const fromProps = readComponentProperties(node);
  if (fromProps) {
    return fromProps;
  }

  const slots: Record<string, string> = {};
  collectNestedInstanceSlots(node, registry, slots);
  return Object.keys(slots).length > 0 ? slots : undefined;
}
