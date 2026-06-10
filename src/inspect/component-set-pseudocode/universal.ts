import type { PseudocodeModel } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRef(value: unknown): value is { $ref: string } {
  return isRecord(value) && typeof value.$ref === "string";
}

function propName(raw: string): string {
  const words = raw
    .replace(/[^A-Za-z0-9_$]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return "value";
  }
  const [first = "value", ...rest] = words;
  return [
    first.charAt(0).toLowerCase() + first.slice(1),
    ...rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)),
  ].join("");
}

type FragmentRowIndex = Map<string, Record<string, unknown>>;
export type NodeBundle = Record<string, Record<string, unknown>>;

function extractToken(value: unknown): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  if (typeof value.token === "string") {
    return value.token;
  }
  if (typeof value.value === "number") {
    return value.value;
  }
  if (
    isRecord(value.background) &&
    typeof value.background.token === "string"
  ) {
    return value.background.token;
  }
  if (typeof value.backgroundToken === "string") {
    return value.backgroundToken;
  }
  if (typeof value.color === "string") {
    return value.color;
  }
  return undefined;
}

function buildFragmentRowIndex(model: PseudocodeModel): FragmentRowIndex {
  const index: FragmentRowIndex = new Map();
  for (const template of model.definitionTemplates) {
    for (const row of template.rows.rows) {
      const [id] = row;
      if (typeof id !== "string") {
        continue;
      }
      index.set(
        id,
        Object.fromEntries(
          template.rows.columns.map((column, columnIndex) => [
            column,
            row[columnIndex],
          ]),
        ),
      );
    }
  }
  return index;
}

function stylePropFromRowKey(key: string): string {
  if (key === "id") {
    return key;
  }
  return key
    .replace(/Token$/i, "")
    .replace(/^(fieldName|button|shadow|icon)/i, "")
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

function isGeometryProp(key: string): boolean {
  return (
    /^padding/i.test(key) ||
    key === "gap" ||
    key === "grow" ||
    key === "width" ||
    key === "height" ||
    key === "alignMain" ||
    key === "alignCross" ||
    key === "alignSelf" ||
    key === "clip" ||
    key === "wrap" ||
    key === "minWidth" ||
    key === "maxWidth" ||
    key === "minHeight" ||
    key === "maxHeight"
  );
}

function partitionProps(props: Record<string, unknown>): {
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
} {
  const visuals: Record<string, unknown> = {};
  const geometry: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (isGeometryProp(key)) {
      geometry[key] = value;
    } else {
      visuals[key] = value;
    }
  }
  return { visuals, geometry };
}

function rowToStyleProps(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id") {
      continue;
    }
    const token = extractToken(value);
    if (token !== undefined) {
      const prop = stylePropFromRowKey(key);
      if (prop.length > 0) {
        props[prop] = token;
      }
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      props[stylePropFromRowKey(key)] = value;
    }
    if (isRecord(value) && !Array.isArray(value)) {
      const prop = stylePropFromRowKey(key);
      if (prop.length > 0) {
        props[prop] = value;
      }
    }
  }
  return props;
}

export function extractVisualsFromNode(
  node: Record<string, unknown>,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const style = isRecord(node.style) ? node.style : undefined;
  const text = isRecord(node.text) ? node.text : undefined;
  const icon = isRecord(node.icon) ? node.icon : undefined;

  if (style) {
    const background = extractToken(style.background);
    if (background !== undefined) {
      props.background = background;
    }
    const border = extractToken(style.border);
    if (border !== undefined) {
      props.border = border;
    }
    if (
      style.border &&
      isRecord(style.border) &&
      style.border.width !== undefined
    ) {
      props.borderWidth = style.border.width;
    }
    const radius = extractToken(style.radius);
    if (radius !== undefined) {
      props.radius = radius;
    }
    if (style.opacity !== undefined && style.opacity !== 1) {
      props.opacity = style.opacity;
    }
  }

  if (text) {
    const color = extractToken(text.color);
    if (color !== undefined) {
      props.color = color;
    }
    if (typeof text.align === "string") {
      props.align = text.align;
    }
    const fontFamily = extractToken(text.fontFamily);
    if (fontFamily !== undefined) {
      props.fontFamily = fontFamily;
    }
    const fontSize = extractToken(text.fontSize);
    if (fontSize !== undefined) {
      props.fontSize = fontSize;
    }
    if (text.fontWeight !== undefined) {
      props.fontWeight = text.fontWeight;
    }
    const fontStyle = extractToken(text.fontStyle);
    if (fontStyle !== undefined) {
      props.fontStyle = fontStyle;
    }
    const lineHeight = extractToken(text.lineHeight);
    if (lineHeight !== undefined) {
      props.lineHeight = lineHeight;
    }
  }

  if (icon) {
    if (icon.size !== undefined) {
      props.iconSize = icon.size;
    }
    const iconColor = extractToken(icon.color);
    if (iconColor !== undefined) {
      props.iconColor = iconColor;
    }
  }

  return props;
}

export function extractGeometryFromNode(
  node: Record<string, unknown>,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const layout = isRecord(node.layout) ? node.layout : undefined;
  if (!layout) {
    return props;
  }

  if (layout.mode === "row" || layout.mode === "column") {
    props.layoutMode = layout.mode;
  }

  const height = extractToken(layout.height);
  if (height !== undefined) {
    props.height = height;
  }
  const width = extractToken(layout.width);
  if (width !== undefined) {
    props.width = width;
  }
  const gap = extractToken(layout.gap);
  if (gap !== undefined) {
    props.gap = gap;
  }

  if (isRecord(layout.padding)) {
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const token = extractToken(layout.padding[side]);
      if (token !== undefined) {
        props[`padding${side.charAt(0).toUpperCase()}${side.slice(1)}`] = token;
      }
    }
  }

  if (isRecord(layout.align)) {
    if (layout.align.main) {
      props.alignMain = layout.align.main;
    }
    if (layout.align.cross) {
      props.alignCross = layout.align.cross;
    }
  }

  if (isRecord(layout.sizing)) {
    if (layout.sizing.horizontal) {
      props.sizingHorizontal = layout.sizing.horizontal;
    }
    if (layout.sizing.vertical) {
      props.sizingVertical = layout.sizing.vertical;
    }
    if (layout.sizing.main) {
      props.sizingMain = layout.sizing.main;
    }
    if (layout.sizing.cross) {
      props.sizingCross = layout.sizing.cross;
    }
  }

  for (const key of [
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
  ] as const) {
    const token = extractToken(layout[key]);
    if (token !== undefined) {
      props[key] = token;
    }
  }

  if (layout.grow !== undefined && layout.grow !== 0) {
    props.grow = layout.grow;
  }
  if (layout.alignSelf !== undefined && layout.alignSelf !== "INHERIT") {
    props.alignSelf = layout.alignSelf;
  }
  if (layout.wrap === true) {
    props.wrap = true;
  }
  if (layout.clip === true) {
    props.clip = true;
  }

  return props;
}

function nodeNameFromValueKey(key: string): string {
  const tokenMatch = key.match(
    /^([a-z][a-zA-Z0-9]*?)(Background|Border|Color|Align|Icon|Gap|Opacity|Padding|Height|Width)/,
  );
  if (tokenMatch?.[1]) {
    return tokenMatch[1];
  }
  return key;
}

export function mergeNodeBundle(
  target: NodeBundle,
  nodeName: string,
  visuals: Record<string, unknown>,
  geometry: Record<string, unknown>,
): void {
  if (Object.keys(visuals).length > 0) {
    target[nodeName] ??= {};
    Object.assign(target[nodeName], visuals);
  }
  if (Object.keys(geometry).length > 0) {
    target[nodeName] ??= {};
    Object.assign(target[nodeName], geometry);
  }
}

function absorbValue(
  visualBundle: NodeBundle,
  geometryBundle: NodeBundle,
  key: string,
  value: unknown,
  fragmentRows: FragmentRowIndex,
): void {
  if (key === "name" || key === "value") {
    return;
  }

  if (isRef(value)) {
    const row = fragmentRows.get(value.$ref);
    if (row) {
      const nodeName = value.$ref.replace(/\d+$/, "");
      const { visuals, geometry } = partitionProps(rowToStyleProps(row));
      mergeNodeBundle(visualBundle, nodeName, visuals, {});
      mergeNodeBundle(geometryBundle, nodeName, {}, geometry);
    }
    return;
  }

  if (isRecord(value) && typeof value.type === "string") {
    const nodeName =
      typeof value.name === "string"
        ? propName(value.name)
        : nodeNameFromValueKey(key);
    mergeNodeBundle(visualBundle, nodeName, extractVisualsFromNode(value), {});
    mergeNodeBundle(
      geometryBundle,
      nodeName,
      {},
      extractGeometryFromNode(value),
    );
    const children = Array.isArray(value.children) ? value.children : [];
    for (const child of children) {
      if (isRecord(child)) {
        absorbValue(
          visualBundle,
          geometryBundle,
          propName(String(child.name ?? "child")),
          child,
          fragmentRows,
        );
      }
      if (isRef(child)) {
        absorbValue(
          visualBundle,
          geometryBundle,
          child.$ref,
          child,
          fragmentRows,
        );
      }
    }
    return;
  }

  const token = extractToken(value);
  if (token !== undefined) {
    const nodeName = nodeNameFromValueKey(key);
    const prop = stylePropFromRowKey(key);
    if (isGeometryProp(prop)) {
      mergeNodeBundle(geometryBundle, nodeName, {}, { [prop]: token });
    } else {
      mergeNodeBundle(visualBundle, nodeName, { [prop]: token }, {});
    }
    return;
  }

  if (isRecord(value)) {
    const { visuals, geometry } = partitionProps(rowToStyleProps(value));
    mergeNodeBundle(visualBundle, key, visuals, {});
    mergeNodeBundle(geometryBundle, key, {}, geometry);
  }
}

function collectVariantEntries(
  model: PseudocodeModel,
): Array<{ when: Record<string, string>; values: Record<string, unknown> }> {
  const entries: Array<{
    when: Record<string, string>;
    values: Record<string, unknown>;
  }> = [];

  for (const group of model.variantGroups) {
    const valueOffset = group.axes.length;
    for (const row of group.rows) {
      const when: Record<string, string> = {
        ...(group.when ?? {}),
        ...Object.fromEntries(
          group.axes.map((axis, index) => [axis, String(row[index])]),
        ),
      };
      const values = Object.fromEntries(
        group.values.map((key, index) => [key, row[valueOffset + index]]),
      );
      entries.push({ when, values });
    }
  }

  return entries;
}

export function orderedAxes(model: PseudocodeModel): string[] {
  return Object.keys(model.variantAxes);
}

export function mergeNestedContracts(
  baseline: Record<string, unknown>,
  overrides: Record<string, unknown>,
  depth: number,
  axesDepth: number,
): Record<string, unknown> {
  if (depth >= axesDepth) {
    const result: NodeBundle = {
      ...(baseline as NodeBundle),
    };
    for (const [nodeName, props] of Object.entries(overrides as NodeBundle)) {
      result[nodeName] = {
        ...(isRecord(result[nodeName]) ? result[nodeName] : {}),
        ...(isRecord(props) ? props : {}),
      };
    }
    return result;
  }

  const result: Record<string, unknown> = { ...baseline };
  for (const [key, value] of Object.entries(overrides)) {
    if (!isRecord(value)) {
      result[key] = value;
      continue;
    }
    result[key] = mergeNestedContracts(
      isRecord(result[key]) ? (result[key] as Record<string, unknown>) : {},
      value,
      depth + 1,
      axesDepth,
    );
  }
  return result;
}

export function setNestedBundle(
  root: Record<string, unknown>,
  axes: string[],
  when: Record<string, string>,
  leaf: NodeBundle,
): void {
  if (axes.length === 0) {
    Object.assign(root, leaf);
    return;
  }

  const [head, ...tail] = axes;
  const raw = when[head];
  if (raw === undefined) {
    return;
  }
  const key = raw;
  if (tail.length === 0) {
    const current = isRecord(root[key]) ? (root[key] as NodeBundle) : {};
    for (const [nodeName, nodeProps] of Object.entries(leaf)) {
      current[nodeName] = {
        ...(isRecord(current[nodeName]) ? current[nodeName] : {}),
        ...nodeProps,
      };
    }
    root[key] = current;
    return;
  }

  root[key] ??= {};
  setNestedBundle(root[key] as Record<string, unknown>, tail, when, leaf);
}

export function buildUniversalContracts(model: PseudocodeModel): {
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
} {
  const axes = orderedAxes(model);
  const fragmentRows = buildFragmentRowIndex(model);
  const visualsRoot: Record<string, unknown> = {};
  const geometryRoot: Record<string, unknown> = {};

  for (const entry of collectVariantEntries(model)) {
    const visualBundle: NodeBundle = {};
    const geometryBundle: NodeBundle = {};
    for (const [key, value] of Object.entries(entry.values)) {
      absorbValue(visualBundle, geometryBundle, key, value, fragmentRows);
    }
    if (Object.keys(visualBundle).length > 0) {
      setNestedBundle(visualsRoot, axes, entry.when, visualBundle);
    }
    if (Object.keys(geometryBundle).length > 0) {
      setNestedBundle(geometryRoot, axes, entry.when, geometryBundle);
    }
  }

  return { visuals: visualsRoot, geometry: geometryRoot };
}
