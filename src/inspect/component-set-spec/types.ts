export interface ComponentSetPropDefinition {
  type: "boolean" | "text" | "instance" | "variant";
  default?: boolean | string;
  options?: string[];
  swapSet?: string;
}

export interface ComponentSetSpec {
  name: string;
  props: Record<string, ComponentSetPropDefinition>;
  baseVariant: Record<string, string>;
  variants: Record<string, string>[];
  layout: SlimNode;
  variantPatches: VariantPatch[];
}

export interface VariantPatch {
  when: Record<string, string>;
  changes: Record<string, unknown>;
}

export interface SlimNode {
  name?: string;
  type: string;
  prop?: string;
  visible?: string;
  layout?: SlimLayout;
  style?: SlimStyle;
  text?: SlimText;
  component?: SlimComponentRef;
  icon?: SlimIcon;
  children?: SlimNode[];
}

export interface SlimLayout {
  mode?: "row" | "column";
  gap?: number;
  padding?: SlimPadding;
  align?: SlimAlign;
  wrap?: boolean;
  sizing?: SlimSizing;
  grow?: number;
  alignSelf?: string;
  maxWidth?: number;
  minWidth?: number;
  maxHeight?: number;
  minHeight?: number;
  clip?: boolean;
}

export interface SlimPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface SlimAlign {
  main?: string;
  cross?: string;
}

export interface SlimSizing {
  horizontal?: string;
  vertical?: string;
  main?: string;
  cross?: string;
}

export interface SlimStyle {
  background?: SlimFill;
  fills?: SlimFill[];
  border?: SlimBorder;
  radius?: number | SlimRadius;
  effects?: SlimEffect[];
  opacity?: number;
}

export interface SlimFill {
  type: "solid" | "gradient" | "image";
  color?: string;
  opacity?: number;
  variable?: string;
  token?: string;
}

export interface SlimBorder {
  color?: string;
  width?: number;
  align?: string;
  variable?: string;
  token?: string;
}

export interface SlimRadius {
  topLeft?: number;
  topRight?: number;
  bottomLeft?: number;
  bottomRight?: number;
  smoothing?: number;
  variable?: string;
  token?: string;
}

export interface SlimEffect {
  type: string;
  [key: string]: unknown;
}

export interface SlimText {
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  align?: string;
  verticalAlign?: string;
  lineHeight?: number;
  letterSpacing?: number;
  autoResize?: string;
  color?: SlimFill;
}

export interface SlimComponentRef {
  id?: string;
  name?: string;
  props?: Record<string, string>;
  swap?: string;
}

export interface SlimIcon {
  size?: number;
  color?: SlimFill;
}
