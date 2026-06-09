import type { FigmaNode } from "./figma-node.js";
import { isRecord, readRecord, readString } from "./figma-node.js";

export function readNodeBoundVariables(
  node: FigmaNode,
): Record<string, unknown> | undefined {
  return readRecord(node, "boundVariables");
}

export function readBoundVariable(
  boundVariables: Record<string, unknown> | undefined,
  field: string,
): string | undefined {
  if (!boundVariables) {
    return undefined;
  }

  return readVariableAlias(boundVariables[field]);
}

export function readBoundVariableAt(
  boundVariables: Record<string, unknown> | undefined,
  field: string,
  index = 0,
): string | undefined {
  if (!boundVariables) {
    return undefined;
  }

  const raw = boundVariables[field];
  if (Array.isArray(raw)) {
    return readVariableAlias(raw[index]);
  }

  return readVariableAlias(raw);
}

function readVariableAlias(raw: unknown): string | undefined {
  if (!isRecord(raw) || readString(raw, "type") !== "VARIABLE_ALIAS") {
    return undefined;
  }

  const id = readString(raw, "id");
  if (!id) {
    return undefined;
  }

  return id.replace(/^VariableID:/, "");
}

const cornerRadiusVariableKeys: Record<keyof CornerRadiusFields, string> = {
  topLeft: "RECTANGLE_TOP_LEFT_CORNER_RADIUS",
  topRight: "RECTANGLE_TOP_RIGHT_CORNER_RADIUS",
  bottomLeft: "RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS",
  bottomRight: "RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS",
};

interface CornerRadiusFields {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}

export function readCornerRadiusVariable(
  boundVariables: Record<string, unknown> | undefined,
  corner: keyof CornerRadiusFields,
): string | undefined {
  if (!boundVariables) {
    return undefined;
  }

  const radii = boundVariables.rectangleCornerRadii;
  if (!isRecord(radii)) {
    return undefined;
  }

  return readBoundVariable(
    radii as Record<string, unknown>,
    cornerRadiusVariableKeys[corner],
  );
}

export function readCornerRadiusUniformVariable(
  boundVariables: Record<string, unknown> | undefined,
): string | undefined {
  return (
    readCornerRadiusVariable(boundVariables, "topLeft") ??
    readCornerRadiusVariable(boundVariables, "topRight") ??
    readCornerRadiusVariable(boundVariables, "bottomLeft") ??
    readCornerRadiusVariable(boundVariables, "bottomRight")
  );
}
