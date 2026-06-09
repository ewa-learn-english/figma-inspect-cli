import type {
  ComponentSetSpec,
  SlimBorder,
  SlimDimension,
  SlimFill,
  SlimLayout,
  SlimNode,
  SlimPadding,
  SlimRadius,
  SlimStyle,
  SlimText,
} from "./types.js";

function fillsEqual(left: SlimFill, right: SlimFill): boolean {
  return (
    JSON.stringify(compactFill(left)) === JSON.stringify(compactFill(right))
  );
}

function compactDimension(
  value: number | SlimDimension | undefined,
): number | SlimDimension | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value.token) {
    return { token: value.token };
  }

  if (typeof value.value === "number") {
    return value.value;
  }

  return undefined;
}

function compactStringDimension(
  value: string | SlimDimension | undefined,
): string | SlimDimension | undefined {
  if (value === undefined || typeof value === "string") {
    return value;
  }

  if (value.token) {
    return { token: value.token };
  }

  if (typeof value.value === "string") {
    return value.value;
  }

  return undefined;
}

function compactFill(fill: SlimFill | undefined): SlimFill | undefined {
  if (!fill) {
    return undefined;
  }

  if (fill.token) {
    const compact: SlimFill = { type: fill.type, token: fill.token };
    if (fill.opacity !== undefined && fill.opacity !== 1) {
      compact.opacity = fill.opacity;
    }
    return compact;
  }

  const compact: SlimFill = { type: fill.type };
  if (fill.color) {
    compact.color = fill.color;
  }
  if (fill.opacity !== undefined && fill.opacity !== 1) {
    compact.opacity = fill.opacity;
  }
  if (fill.variable) {
    compact.variable = fill.variable;
  }

  return compact;
}

function isDefaultBorder(border: SlimBorder | undefined): boolean {
  if (!border) {
    return true;
  }

  const width = border.width ?? 1;
  const hasColor = Boolean(border.color ?? border.token ?? border.variable);

  return width === 1 && !hasColor;
}

function compactBorder(border: SlimBorder | undefined): SlimBorder | undefined {
  if (!border || isDefaultBorder(border)) {
    return undefined;
  }

  if (border.token) {
    const compact: SlimBorder = { token: border.token };
    if (border.width !== undefined && border.width !== 1) {
      compact.width = border.width;
    }
    if (border.align !== undefined && border.align !== "INSIDE") {
      compact.align = border.align;
    }
    return compact;
  }

  const compact: SlimBorder = {};
  if (border.color) {
    compact.color = border.color;
  }
  if (border.variable) {
    compact.variable = border.variable;
  }
  if (border.width !== undefined && border.width !== 1) {
    compact.width = border.width;
  }
  if (border.align !== undefined) {
    compact.align = border.align;
  }

  return isDefaultBorder(compact) ? undefined : compact;
}

function compactPadding(
  padding: SlimPadding | undefined,
): SlimPadding | undefined {
  if (!padding) {
    return undefined;
  }

  const compact: SlimPadding = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const value = compactDimension(padding[side]);
    if (value !== undefined) {
      compact[side] = value;
    }
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function compactTypography(
  value: string | number | SlimDimension | undefined,
): string | number | SlimDimension | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return compactStringDimension(value);
  }

  if (typeof value === "number") {
    return compactDimension(value);
  }

  if (typeof value.value === "string") {
    return compactStringDimension(value);
  }

  return compactDimension(value);
}

function isSlimRadius(value: SlimDimension | SlimRadius): value is SlimRadius {
  return (
    "topLeft" in value ||
    "topRight" in value ||
    "bottomLeft" in value ||
    "bottomRight" in value ||
    "smoothing" in value
  );
}

function compactRadius(
  radius: number | SlimDimension | SlimRadius | undefined,
): number | SlimDimension | SlimRadius | undefined {
  if (radius === undefined || typeof radius === "number") {
    return radius;
  }

  if (!isSlimRadius(radius)) {
    return compactDimension(radius);
  }

  const compact: SlimRadius = {};
  for (const corner of [
    "topLeft",
    "topRight",
    "bottomLeft",
    "bottomRight",
  ] as const) {
    const value = compactDimension(radius[corner]);
    if (value !== undefined) {
      compact[corner] = value;
    }
  }

  if (radius.smoothing !== undefined) {
    compact.smoothing = radius.smoothing;
  }

  if (radius.token) {
    compact.token = radius.token;
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function compactLayout(layout: SlimLayout | undefined): SlimLayout | undefined {
  if (!layout) {
    return undefined;
  }

  const compact: SlimLayout = {};

  if (layout.mode) {
    compact.mode = layout.mode;
  }

  const gap = compactDimension(layout.gap);
  if (gap !== undefined) {
    compact.gap = gap;
  }

  const padding = compactPadding(layout.padding);
  if (padding) {
    compact.padding = padding;
  }

  if (layout.align) {
    const align = { ...layout.align };
    if (Object.keys(align).length > 0) {
      compact.align = align;
    }
  }

  if (layout.wrap) {
    compact.wrap = layout.wrap;
  }

  if (layout.sizing) {
    compact.sizing = layout.sizing;
  }

  if (layout.grow !== undefined && layout.grow !== 0) {
    compact.grow = layout.grow;
  }

  if (layout.alignSelf !== undefined && layout.alignSelf !== "INHERIT") {
    compact.alignSelf = layout.alignSelf;
  }

  for (const key of [
    "maxWidth",
    "minWidth",
    "maxHeight",
    "minHeight",
  ] as const) {
    const value = compactDimension(layout[key]);
    if (value !== undefined) {
      compact[key] = value;
    }
  }

  if (layout.clip === true) {
    compact.clip = true;
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function compactStyle(style: SlimStyle | undefined): SlimStyle | undefined {
  if (!style) {
    return undefined;
  }

  const background = compactFill(style.background);
  const fills = style.fills?.map((fill) => compactFill(fill)).filter(Boolean) as
    | SlimFill[]
    | undefined;
  const firstFill = fills?.[0];
  const redundantFills =
    background &&
    firstFill &&
    fills?.length === 1 &&
    fillsEqual(background, firstFill)
      ? undefined
      : fills;

  const compact: SlimStyle = {};

  if (background) {
    compact.background = background;
  }
  if (redundantFills && redundantFills.length > 0) {
    compact.fills = redundantFills;
  }

  const border = compactBorder(style.border);
  if (border) {
    compact.border = border;
  }

  const radius = compactRadius(style.radius);
  if (radius !== undefined) {
    compact.radius = radius;
  }

  if (style.effects && style.effects.length > 0) {
    compact.effects = style.effects;
  }

  if (style.opacity !== undefined && style.opacity !== 1) {
    compact.opacity = style.opacity;
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function compactText(text: SlimText | undefined): SlimText | undefined {
  if (!text) {
    return undefined;
  }

  const compact: SlimText = {};

  if (text.content) {
    compact.content = text.content;
  }

  const fontFamily = compactTypography(text.fontFamily);
  if (fontFamily !== undefined) {
    compact.fontFamily = fontFamily as SlimText["fontFamily"];
  }

  const fontSize = compactTypography(text.fontSize);
  if (fontSize !== undefined) {
    compact.fontSize = fontSize as SlimText["fontSize"];
  }

  const fontWeight = compactTypography(text.fontWeight);
  if (fontWeight !== undefined) {
    compact.fontWeight = fontWeight as SlimText["fontWeight"];
  }

  const fontStyle = compactTypography(text.fontStyle);
  if (fontStyle !== undefined) {
    compact.fontStyle = fontStyle as SlimText["fontStyle"];
  }

  const lineHeight = compactTypography(text.lineHeight);
  if (lineHeight !== undefined) {
    compact.lineHeight = (
      typeof lineHeight === "number" ? roundNumber(lineHeight) : lineHeight
    ) as SlimText["lineHeight"];
  }

  const letterSpacing = compactTypography(text.letterSpacing);
  if (
    letterSpacing !== undefined &&
    !(typeof letterSpacing === "number" && letterSpacing === 0)
  ) {
    compact.letterSpacing = (
      typeof letterSpacing === "number"
        ? roundNumber(letterSpacing)
        : letterSpacing
    ) as SlimText["letterSpacing"];
  }

  if (text.align) {
    compact.align = text.align;
  }
  if (text.verticalAlign && text.verticalAlign !== "TOP") {
    compact.verticalAlign = text.verticalAlign;
  }
  if (text.autoResize && text.autoResize !== "HEIGHT") {
    compact.autoResize = text.autoResize;
  }

  const color = compactFill(text.color);
  if (color) {
    compact.color = color;
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function compactNode(node: SlimNode): SlimNode {
  const compact: SlimNode = {
    type: node.type,
  };

  if (node.name) {
    compact.name = node.name;
  }
  if (node.prop) {
    compact.prop = node.prop;
  }
  if (node.visible) {
    compact.visible = node.visible;
  }

  const layout = compactLayout(node.layout);
  if (layout) {
    compact.layout = layout;
  }

  let style = compactStyle(node.style);
  const text = compactText(node.text);
  if (text) {
    compact.text = text;
    if (
      style?.background &&
      text.color &&
      fillsEqual(style.background, text.color)
    ) {
      const { background: _background, ...rest } = style;
      style = Object.keys(rest).length > 0 ? rest : undefined;
    }
  }

  if (style) {
    compact.style = style;
  }

  if (node.component !== undefined) {
    if (typeof node.component === "string") {
      compact.component = node.component;
    } else {
      compact.component = node.component;
    }
  }

  if (node.slots) {
    compact.slots = node.slots;
  }

  if (node.icon) {
    compact.icon = {
      size: node.icon.size,
      color: compactFill(node.icon.color),
    };
    if (!compact.icon.color && compact.icon.size === undefined) {
      delete compact.icon;
    }
  }

  if (node.children) {
    compact.children = node.children.map((child) => compactNode(child));
  }

  return compact;
}

export function compactSpec(spec: ComponentSetSpec): ComponentSetSpec {
  return {
    ...spec,
    variants: spec.variants.map((variant) => ({
      when: variant.when,
      layout: compactNode(variant.layout),
    })),
  };
}
