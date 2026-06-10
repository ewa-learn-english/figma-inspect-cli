import type {
  ComponentSetPropDefinition,
  SlimNode,
} from "../component-set-spec/types.js";

export interface PseudocodeModel {
  name: string;
  props: Record<string, ComponentSetPropDefinition>;
  baseVariant: Record<string, string>;
  variantAxes: Record<string, string[]>;
  definitions: Record<string, SlimNode>;
  definitionTemplates: PseudocodeDefinitionTemplate[];
  templates: PseudocodeTemplate[];
  variantGroups: PseudocodeVariantGroup[];
  stats: PseudocodeStats;
}

interface PseudocodeStats {
  variants: number;
  definitions: number;
  definitionTemplates: number;
  templates: number;
  variantGroups: number;
}

export interface PseudocodeDefinitionTemplate {
  name: string;
  variables: string[];
  node: unknown;
  rows: PseudocodeTable;
}

export interface PseudocodeTemplate {
  name: string;
  when?: Record<string, string>;
  variables: string[];
  layout: unknown;
}

export interface PseudocodeVariantGroup {
  template: string;
  when?: Record<string, string>;
  axes: string[];
  values: string[];
  rows: unknown[][];
}

interface PseudocodeTable {
  columns: string[];
  rows: unknown[][];
}
