import {
  readBoundVariable,
  readBoundVariableAt,
  readCornerRadiusUniformVariable,
  readCornerRadiusVariable,
  readNodeBoundVariables,
} from "./bound-variables.js";
import { extractInstanceSlots } from "./extract-slots.js";
import {
  type FigmaNode,
  isRecord,
  readArray,
  readBoolean,
  readChildren,
  readNumber,
  readRecord,
  readString,
} from "./figma-node.js";
import type { SlimContext } from "./slim-context.js";
import type {
  SlimAlign,
  SlimBorder,
  SlimComponentRef,
  SlimDimension,
  SlimEffect,
  SlimFill,
  SlimIcon,
  SlimLayout,
  SlimNode,
  SlimPadding,
  SlimRadius,
  SlimSizing,
  SlimStyle,
  SlimText,
} from "./types.js";

function pruneEmpty<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, entry]) => {
      if (entry === undefined || entry === null) {
        return false;
      }

      if (Array.isArray(entry)) {
        return entry.length > 0;
      }

      if (isRecord(entry)) {
        return Object.keys(entry).length > 0;
      }

      return true;
    },
  );

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as T;
}

function variableId(raw: unknown): string | undefined {
  if (!isRecord(raw) || readString(raw, "type") !== "VARIABLE_ALIAS") {
    return undefined;
  }

  const id = readString(raw, "id");
  if (!id) {
    return undefined;
  }

  return id.replace(/^VariableID:/, "");
}

function slimDimension(
  value: number | undefined,
  variable: string | undefined,
): number | SlimDimension | undefined {
  if (variable) {
    return pruneEmpty({ value, variable });
  }

  return value;
}

function slimStringDimension(
  value: string | undefined,
  variable: string | undefined,
): string | SlimDimension | undefined {
  if (variable) {
    return pruneEmpty({ value, variable });
  }

  return value;
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function slimFill(raw: unknown): SlimFill | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const type = readString(raw, "type");
  if (type === "SOLID") {
    const color = readRecord(raw, "color");
    const boundVariable = variableId(readRecord(raw, "boundVariables")?.color);
    const fill: SlimFill = { type: "solid" };

    if (color) {
      fill.color = rgbToHex(
        readNumber(color, "r") ?? 0,
        readNumber(color, "g") ?? 0,
        readNumber(color, "b") ?? 0,
      );
      fill.opacity = readNumber(color, "a");
    }

    if (boundVariable) {
      fill.variable = boundVariable;
    }

    return pruneEmpty(fill);
  }

  if (type === "GRADIENT_LINEAR" || type === "GRADIENT_RADIAL") {
    return { type: "gradient" };
  }

  if (type === "IMAGE") {
    return { type: "image" };
  }

  if (readString(raw, "type") === "VARIABLE_ALIAS") {
    const bound = variableId(raw);
    return bound ? { type: "solid", variable: bound } : undefined;
  }

  return undefined;
}

function slimFills(raw: unknown): SlimFill[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const fills = raw
    .map((entry) => slimFill(entry))
    .filter((entry): entry is SlimFill => entry !== undefined);

  return fills.length > 0 ? fills : undefined;
}

function slimPadding(node: FigmaNode): SlimPadding | undefined {
  const bound = readNodeBoundVariables(node);
  const padding: SlimPadding = {
    top: slimDimension(
      readNumber(node, "paddingTop"),
      readBoundVariable(bound, "paddingTop"),
    ),
    right: slimDimension(
      readNumber(node, "paddingRight"),
      readBoundVariable(bound, "paddingRight"),
    ),
    bottom: slimDimension(
      readNumber(node, "paddingBottom"),
      readBoundVariable(bound, "paddingBottom"),
    ),
    left: slimDimension(
      readNumber(node, "paddingLeft"),
      readBoundVariable(bound, "paddingLeft"),
    ),
  };

  return pruneEmpty(padding);
}

function slimAlign(node: FigmaNode): SlimAlign | undefined {
  const align: SlimAlign = {
    main: readString(node, "primaryAxisAlignItems"),
    cross: readString(node, "counterAxisAlignItems"),
  };

  return pruneEmpty(align);
}

function slimSizing(node: FigmaNode): SlimSizing | undefined {
  const sizing: SlimSizing = {
    horizontal: readString(node, "layoutSizingHorizontal"),
    vertical: readString(node, "layoutSizingVertical"),
    main: readString(node, "primaryAxisSizingMode"),
    cross: readString(node, "counterAxisSizingMode"),
  };

  return pruneEmpty(sizing);
}

function slimLayoutDimensions(
  node: FigmaNode,
  sizing: SlimSizing | undefined,
): Pick<SlimLayout, "width" | "height"> {
  const box = readRecord(node, "absoluteBoundingBox");
  if (!box) {
    return {};
  }

  const bboxWidth = readNumber(box, "width");
  const bboxHeight = readNumber(box, "height");
  const dimensions: Pick<SlimLayout, "width" | "height"> = {};

  if (sizing?.horizontal !== "FILL" && bboxWidth !== undefined) {
    dimensions.width = bboxWidth;
  }
  if (sizing?.vertical !== "FILL" && bboxHeight !== undefined) {
    dimensions.height = bboxHeight;
  }

  return dimensions;
}

function slimLayout(node: FigmaNode): SlimLayout | undefined {
  const bound = readNodeBoundVariables(node);
  const layoutMode = readString(node, "layoutMode");
  const sizing = slimSizing(node);
  const layout: SlimLayout = {
    gap: slimDimension(
      readNumber(node, "itemSpacing"),
      readBoundVariable(bound, "itemSpacing"),
    ),
    padding: slimPadding(node),
    align: slimAlign(node),
    wrap: readString(node, "layoutWrap") === "WRAP" ? true : undefined,
    sizing,
    ...slimLayoutDimensions(node, sizing),
    grow: readNumber(node, "layoutGrow"),
    alignSelf: readString(node, "layoutAlign"),
    maxWidth: slimDimension(
      readNumber(node, "maxWidth"),
      readBoundVariable(bound, "maxWidth"),
    ),
    minWidth: slimDimension(
      readNumber(node, "minWidth"),
      readBoundVariable(bound, "minWidth"),
    ),
    maxHeight: slimDimension(
      readNumber(node, "maxHeight"),
      readBoundVariable(bound, "maxHeight"),
    ),
    minHeight: slimDimension(
      readNumber(node, "minHeight"),
      readBoundVariable(bound, "minHeight"),
    ),
    clip: readBoolean(node, "clipsContent"),
  };

  if (layoutMode === "HORIZONTAL") {
    layout.mode = "row";
  } else if (layoutMode === "VERTICAL") {
    layout.mode = "column";
  }

  return pruneEmpty(layout);
}

function slimRadius(
  node: FigmaNode,
): number | SlimDimension | SlimRadius | undefined {
  const bound = readNodeBoundVariables(node);
  const cornerRadius = readNumber(node, "cornerRadius");
  const radii = readRecord(node, "rectangleCornerRadii");
  const smoothing = readNumber(node, "cornerSmoothing");
  const uniformVariable = readCornerRadiusUniformVariable(bound);

  if (radii) {
    const radius: SlimRadius = {
      topLeft: slimDimension(
        readNumber(radii, "topLeftRadius"),
        readCornerRadiusVariable(bound, "topLeft"),
      ),
      topRight: slimDimension(
        readNumber(radii, "topRightRadius"),
        readCornerRadiusVariable(bound, "topRight"),
      ),
      bottomLeft: slimDimension(
        readNumber(radii, "bottomLeftRadius"),
        readCornerRadiusVariable(bound, "bottomLeft"),
      ),
      bottomRight: slimDimension(
        readNumber(radii, "bottomRightRadius"),
        readCornerRadiusVariable(bound, "bottomRight"),
      ),
      smoothing,
    };

    return pruneEmpty(radius);
  }

  if (cornerRadius !== undefined) {
    if (uniformVariable) {
      return pruneEmpty({ value: cornerRadius, variable: uniformVariable });
    }

    return cornerRadius;
  }

  return undefined;
}

function slimBorder(node: FigmaNode): SlimBorder | undefined {
  const strokes = slimFills(node.strokes);
  const strokeWeight = readNumber(node, "strokeWeight");
  if (!strokes && (strokeWeight === undefined || strokeWeight === 0)) {
    return undefined;
  }

  const border: SlimBorder = {
    width: strokeWeight,
    align: readString(node, "strokeAlign"),
  };

  const firstStroke = strokes?.[0];
  if (firstStroke?.color) {
    border.color = firstStroke.color;
  }
  if (firstStroke?.variable) {
    border.variable = firstStroke.variable;
  }

  return pruneEmpty(border);
}

function slimEffects(node: FigmaNode): SlimEffect[] | undefined {
  const effects = readArray(node, "effects");
  if (!effects || effects.length === 0) {
    return undefined;
  }

  const parsed = effects
    .filter(isRecord)
    .map((effect) => {
      const type = readString(effect, "type");
      if (!type || type === "NONE") {
        return undefined;
      }

      const slim: SlimEffect = { type: type.toLowerCase() };
      const radius = readNumber(effect, "radius");
      const spread = readNumber(effect, "spread");
      const offset = readRecord(effect, "offset");
      const color = slimFill(effect.color);

      if (radius !== undefined) {
        slim.radius = radius;
      }
      if (spread !== undefined) {
        slim.spread = spread;
      }
      if (offset) {
        slim.offset = {
          x: readNumber(offset, "x"),
          y: readNumber(offset, "y"),
        };
      }
      if (color) {
        slim.color = color;
      }

      return pruneEmpty(slim);
    })
    .filter((effect): effect is SlimEffect => effect !== undefined);

  return parsed.length > 0 ? parsed : undefined;
}

function slimStyle(node: FigmaNode): SlimStyle | undefined {
  const fills = slimFills(node.fills);
  const style: SlimStyle = {
    background: fills?.[0],
    fills,
    border: slimBorder(node),
    radius: slimRadius(node),
    effects: slimEffects(node),
    opacity: readNumber(node, "opacity"),
  };

  return pruneEmpty(style);
}

function slimTextStyle(node: FigmaNode): SlimText | undefined {
  const style = readRecord(node, "style");
  const bound = readNodeBoundVariables(node);
  const text: SlimText = {
    content: readString(node, "characters"),
    fontFamily: slimStringDimension(
      style ? readString(style, "fontFamily") : undefined,
      readBoundVariableAt(bound, "fontFamily"),
    ),
    fontSize: slimDimension(
      style ? readNumber(style, "fontSize") : undefined,
      readBoundVariableAt(bound, "fontSize"),
    ),
    fontWeight: slimDimension(
      style ? readNumber(style, "fontWeight") : undefined,
      readBoundVariableAt(bound, "fontWeight"),
    ),
    fontStyle: slimStringDimension(
      style ? readString(style, "fontStyle") : undefined,
      readBoundVariableAt(bound, "fontStyle"),
    ),
    align: style ? readString(style, "textAlignHorizontal") : undefined,
    verticalAlign: style ? readString(style, "textAlignVertical") : undefined,
    lineHeight: slimDimension(
      style ? readNumber(style, "lineHeightPx") : undefined,
      readBoundVariableAt(bound, "lineHeight"),
    ),
    letterSpacing: slimDimension(
      style ? readNumber(style, "letterSpacing") : undefined,
      readBoundVariableAt(bound, "letterSpacing"),
    ),
    autoResize: style ? readString(style, "textAutoResize") : undefined,
    color: slimFills(node.fills)?.[0],
  };

  return pruneEmpty(text);
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
      props[key] = propValue;
    }
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

function resolvePropReference(
  references: Record<string, unknown> | undefined,
  field: string,
  propIdToName: Map<string, string>,
): string | undefined {
  const raw = references?.[field];
  if (typeof raw !== "string") {
    return undefined;
  }

  return propIdToName.get(raw) ?? toPropName(raw);
}

function toPropName(rawKey: string): string {
  const baseName = rawKey.split("#")[0] ?? rawKey;
  if (baseName.length === 0) {
    return rawKey;
  }

  return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

function slimComponentRef(
  node: FigmaNode,
  propIdToName: Map<string, string>,
): SlimComponentRef | undefined {
  const references = readRecord(node, "componentPropertyReferences");
  const component: SlimComponentRef = {
    id: readString(node, "componentId"),
    name: readString(node, "name"),
    props: readComponentProperties(node),
    swap: references
      ? resolvePropReference(references, "mainComponent", propIdToName)
      : undefined,
  };

  return pruneEmpty(component);
}

function readIconSize(node: FigmaNode): number | undefined {
  const box = readRecord(node, "absoluteBoundingBox");
  if (!box) {
    return undefined;
  }

  const width = readNumber(box, "width");
  const height = readNumber(box, "height");
  if (width === undefined && height === undefined) {
    return undefined;
  }

  return Math.round(Math.max(width ?? 0, height ?? 0));
}

function isIconInstance(children: FigmaNode[]): boolean {
  if (children.length !== 1) {
    return false;
  }

  return readString(children[0], "type") === "VECTOR";
}

function slimIconFromInstance(node: FigmaNode): SlimIcon | undefined {
  const children = readChildren(node);
  if (!isIconInstance(children)) {
    return undefined;
  }

  const vector = children[0];
  const icon: SlimIcon = {
    size: readIconSize(node),
    color: slimFills(vector.fills)?.[0],
  };

  return pruneEmpty(icon);
}

function slimChildren(
  node: FigmaNode,
  context: SlimContext,
): SlimNode[] | undefined {
  const children = readChildren(node)
    .map((child) => slimNode(child, context))
    .filter((child): child is SlimNode => child !== undefined);

  return children.length > 0 ? children : undefined;
}

export function slimNode(
  node: FigmaNode,
  context: SlimContext,
): SlimNode | undefined {
  const type = readString(node, "type");
  if (!type) {
    return undefined;
  }

  const references = readRecord(node, "componentPropertyReferences");
  const propIdToName = context.propIdToName;
  const slim: SlimNode = {
    name: readString(node, "name"),
    type: type.toLowerCase(),
    prop: references
      ? (resolvePropReference(references, "characters", propIdToName) ??
        resolvePropReference(references, "mainComponent", propIdToName))
      : undefined,
    visible: references
      ? resolvePropReference(references, "visible", propIdToName)
      : undefined,
    layout: slimLayout(node),
    style: slimStyle(node),
  };

  if (type === "TEXT") {
    slim.text = slimTextStyle(node);
    if (references) {
      slim.prop =
        resolvePropReference(references, "characters", propIdToName) ??
        slim.prop;
    }
  }

  if (type === "INSTANCE") {
    const componentName = readString(node, "name");
    const componentId = readString(node, "componentId");

    if (context.teamComponents?.isKnownComponent(componentName, componentId)) {
      slim.type = "component";
      slim.component = componentName ?? componentId;
      slim.slots = extractInstanceSlots(node, context.teamComponents);
    } else {
      slim.component = slimComponentRef(node, propIdToName);
      const icon = slimIconFromInstance(node);
      if (icon) {
        slim.icon = icon;
      } else {
        slim.children = slimChildren(node, context);
      }
    }
  } else if (type !== "VECTOR") {
    slim.children = slimChildren(node, context);
  }

  return pruneEmpty(slim);
}
