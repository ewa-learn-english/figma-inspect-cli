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
  variantAxes: Record<string, string[]>;
  variants: ComponentSetVariant[];
}

export interface ComponentSetVariant {
  when: Record<string, string>;
  layout: SlimNode;
}

export interface SlimNode {
  name?: string;
  type: string;
  prop?: string;
  visible?: string;
  layout?: SlimLayout;
  style?: SlimStyle;
  text?: SlimText;
  component?: string | SlimComponentRef;
  slots?: Record<string, string>;
  icon?: SlimIcon;
  children?: SlimNode[];
}

export interface SlimDimension {
  value?: number | string;
  variable?: string;
  token?: string;
}

export interface SlimLayout {
  mode?: "row" | "column";
  gap?: number | SlimDimension;
  padding?: SlimPadding;
  align?: SlimAlign;
  wrap?: boolean;
  sizing?: SlimSizing;
  grow?: number;
  alignSelf?: string;
  maxWidth?: number | SlimDimension;
  minWidth?: number | SlimDimension;
  maxHeight?: number | SlimDimension;
  minHeight?: number | SlimDimension;
  clip?: boolean;
}

export interface SlimPadding {
  top?: number | SlimDimension;
  right?: number | SlimDimension;
  bottom?: number | SlimDimension;
  left?: number | SlimDimension;
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
  radius?: number | SlimDimension | SlimRadius;
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
  topLeft?: number | SlimDimension;
  topRight?: number | SlimDimension;
  bottomLeft?: number | SlimDimension;
  bottomRight?: number | SlimDimension;
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
  fontFamily?: string | SlimDimension;
  fontSize?: number | SlimDimension;
  fontWeight?: number | SlimDimension;
  fontStyle?: string | SlimDimension;
  align?: string;
  verticalAlign?: string;
  lineHeight?: number | SlimDimension;
  letterSpacing?: number | SlimDimension;
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
