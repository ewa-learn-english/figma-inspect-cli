import type {
  ComponentSetSpec,
  SlimNode,
} from "../component-set-spec/types.js";
import { stableStringify } from "../contract/stable-stringify.js";
import { isNode, isRecord, isRef } from "./slim-node-guards.js";
import type {
  PseudocodeDefinitionTemplate,
  PseudocodeModel,
  PseudocodeTemplate,
  PseudocodeVariantGroup,
} from "./types.js";

const NODE_DEFINITION_MIN_BYTES = 140;
const NODE_TYPES = new Set([
  "component",
  "ellipse",
  "frame",
  "group",
  "instance",
  "line",
  "rectangle",
  "text",
  "vector",
]);

function isDedupeNode(value: unknown): value is SlimNode {
  return isNode(value) && NODE_TYPES.has(value.type);
}

function collectNodeCounts(
  value: unknown,
  counts = new Map<string, { count: number; node: SlimNode }>(),
): Map<string, { count: number; node: SlimNode }> {
  if (value === undefined || value === null || typeof value !== "object") {
    return counts;
  }

  if (isDedupeNode(value)) {
    const key = stableStringify(value);
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { count: 1, node: value });
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectNodeCounts(entry, counts);
    }
    return counts;
  }

  for (const entry of Object.values(value)) {
    collectNodeCounts(entry, counts);
  }
  return counts;
}

function toWords(raw: string): string[] {
  return raw
    .replace(/^\$/, "ref ")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function toCamelCase(words: string[], fallback: string): string {
  const source = words.length > 0 ? words : [fallback];
  const [first = fallback, ...rest] = source;
  return [
    first.charAt(0).toLowerCase() + first.slice(1),
    ...rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)),
  ].join("");
}

function definitionBaseName(node: SlimNode): string {
  const raw =
    node.name ??
    (typeof node.component === "string"
      ? node.component
      : node.component?.name) ??
    node.type;
  return toCamelCase(toWords(raw), `${node.type}Node`);
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}${suffix}`;
    suffix += 1;
  }
  used.add(name);
  return name;
}

interface DefinitionCandidate {
  id: string;
  key: string;
  node: SlimNode;
}

function buildDefinitionCandidates(
  variants: ComponentSetSpec["variants"],
): DefinitionCandidate[] {
  const counts = collectNodeCounts(variants);
  const used = new Set<string>();
  return [...counts.entries()]
    .map(([key, entry]) => {
      const bytes = JSON.stringify(entry.node).length;
      return {
        key,
        node: entry.node,
        bytes,
        count: entry.count,
        saved: (entry.count - 1) * bytes,
      };
    })
    .filter(
      (entry) =>
        entry.count > 1 &&
        entry.bytes >= NODE_DEFINITION_MIN_BYTES &&
        entry.saved >= entry.bytes,
    )
    .sort((left, right) => right.saved - left.saved)
    .map((entry) => ({
      id: uniqueName(definitionBaseName(entry.node), used),
      key: entry.key,
      node: entry.node,
    }));
}

function replaceDefinitionsInNode(
  node: unknown,
  candidates: Map<string, DefinitionCandidate>,
): unknown {
  if (isRef(node)) {
    return node;
  }
  if (!isNode(node)) {
    return node;
  }

  const candidate = candidates.get(stableStringify(node));
  if (candidate) {
    return { $ref: candidate.id };
  }

  if (!node.children) {
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) =>
      replaceDefinitionsInNode(child, candidates),
    ),
  };
}

function collectRefs(value: unknown, refs = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectRefs(entry, refs);
    }
    return refs;
  }
  if (!isRecord(value)) {
    return refs;
  }
  if (typeof value.$ref === "string") {
    refs.add(value.$ref);
  }
  for (const entry of Object.values(value)) {
    collectRefs(entry, refs);
  }
  return refs;
}

function dedupeVariantNodes(variants: ComponentSetSpec["variants"]): {
  definitions: Record<string, SlimNode>;
  variants: ComponentSetSpec["variants"];
} {
  const candidates = buildDefinitionCandidates(variants);
  if (candidates.length === 0) {
    return { definitions: {}, variants };
  }

  const byKey = new Map(
    candidates.map((candidate) => [candidate.key, candidate]),
  );
  const deduped = variants.map((variant) => ({
    when: variant.when,
    layout: replaceDefinitionsInNode(variant.layout, byKey) as SlimNode,
  }));

  const usedRefs = new Set<string>();
  for (const variant of deduped) {
    collectRefs(variant.layout, usedRefs);
  }

  const definitions = Object.fromEntries(
    candidates
      .filter((candidate) => usedRefs.has(candidate.id))
      .map((candidate) => [candidate.id, candidate.node]),
  );

  return { definitions, variants: deduped };
}

function keySignature(value: unknown): string {
  if (Array.isArray(value)) {
    return `array:${value.length}`;
  }
  if (!isRecord(value)) {
    return typeof value;
  }
  if (isRef(value)) {
    return "ref";
  }
  const type = typeof value.type === "string" ? value.type : "object";
  return `${type}:${Object.keys(value).sort().join(",")}`;
}

function objectKeysEqual(values: Record<string, unknown>[]): boolean {
  if (values.length === 0) {
    return true;
  }
  const first = Object.keys(values[0]).sort().join("\0");
  return values.every(
    (value) => Object.keys(value).sort().join("\0") === first,
  );
}

function pathVariableName(path: string[], used: Set<string>): string {
  const last = path.at(-1);
  if (last && path.length > 1 && ["layout", "style", "text"].includes(last)) {
    return uniqueName(last, used);
  }

  const filtered = (path[0] === "root" ? path.slice(1) : path).filter(
    (part) =>
      part !== "children" &&
      part !== "layout" &&
      part !== "style" &&
      part !== "text",
  );
  const base = toCamelCase(filtered.flatMap(toWords), "value");
  return uniqueName(base, used);
}

function labelFromValue(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (typeof value.$ref === "string") {
    return value.$ref.replace(/\d+$/, "");
  }
  if (typeof value.name === "string") {
    return value.name;
  }
  return typeof value.type === "string" ? value.type : undefined;
}

function arrayPathSegment(values: unknown[], index: number): string {
  const labels = values
    .map((value) => labelFromValue(value))
    .filter((label) => label !== undefined);
  const [first] = labels;
  if (
    first &&
    labels.length === values.length &&
    labels.every((label) => label === first)
  ) {
    return first;
  }
  return `item${index + 1}`;
}

interface TemplateContext {
  usedNames: Set<string>;
  valuesByIndex: Record<string, unknown>[];
}

function assignVariable(
  values: unknown[],
  path: string[],
  context: TemplateContext,
): { $var: string } {
  const name = pathVariableName(path, context.usedNames);
  values.forEach((value, index) => {
    context.valuesByIndex[index][name] = value;
  });
  return { $var: name };
}

function buildTemplateValue(
  values: unknown[],
  path: string[],
  context: TemplateContext,
): unknown {
  const [first] = values;
  if (
    values.every((value) => stableStringify(value) === stableStringify(first))
  ) {
    return first;
  }

  if (values.every(Array.isArray)) {
    const arrays = values as unknown[][];
    const length = arrays[0]?.length;
    if (
      length !== undefined &&
      arrays.every((array) => array.length === length)
    ) {
      return arrays[0].map((_, index) =>
        buildTemplateValue(
          arrays.map((array) => array[index]),
          [
            ...path,
            arrayPathSegment(
              arrays.map((array) => array[index]),
              index,
            ),
          ],
          context,
        ),
      );
    }
  }

  if (values.every(isRecord)) {
    const objects = values as Record<string, unknown>[];
    if (
      objectKeysEqual(objects) &&
      !objects.some((object) => "$ref" in object)
    ) {
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(objects[0])) {
        output[key] = buildTemplateValue(
          objects.map((object) => object[key]),
          [...path, key],
          context,
        );
      }
      return output;
    }
  }

  return assignVariable(values, path, context);
}

interface TemplateResult {
  value: unknown;
  variables: string[];
  valuesByIndex: Record<string, unknown>[];
}

function buildTemplate(values: unknown[]): TemplateResult {
  const context: TemplateContext = {
    usedNames: new Set<string>(),
    valuesByIndex: values.map(() => ({})),
  };
  const value = buildTemplateValue(values, ["root"], context);
  return {
    value,
    variables: [...context.usedNames],
    valuesByIndex: context.valuesByIndex,
  };
}

function templateSavings(values: unknown[], result: TemplateResult): number {
  const originalBytes = JSON.stringify(values, null, 2).length;
  const templatedBytes =
    JSON.stringify(result.value, null, 2).length +
    JSON.stringify(result.valuesByIndex, null, 2).length;
  return originalBytes - templatedBytes;
}

function compressDefinitionTemplates(definitions: Record<string, SlimNode>): {
  definitions: Record<string, SlimNode>;
  templates: PseudocodeDefinitionTemplate[];
} {
  const groups = new Map<string, [string, SlimNode][]>();
  for (const [id, node] of Object.entries(definitions)) {
    const key = `${definitionBaseName(node)}\0${keySignature(node)}`;
    groups.set(key, [...(groups.get(key) ?? []), [id, node]]);
  }

  const usedNames = new Set<string>();
  const grouped: {
    ids: Set<string>;
    template: PseudocodeDefinitionTemplate;
  }[] = [];

  for (const entries of groups.values()) {
    if (entries.length < 2) {
      continue;
    }

    const result = buildTemplate(entries.map(([, node]) => node));
    if (
      result.variables.length === 0 ||
      templateSavings(entries, result) <= 0
    ) {
      continue;
    }

    const [first] = entries;
    const name = uniqueName(definitionBaseName(first[1]), usedNames);
    grouped.push({
      ids: new Set(entries.map(([id]) => id)),
      template: {
        name,
        variables: result.variables,
        node: result.value,
        rows: {
          columns: ["id", ...result.variables],
          rows: entries.map(([id], index) => [
            id,
            ...result.variables.map(
              (variable) => result.valuesByIndex[index][variable],
            ),
          ]),
        },
      },
    });
  }

  const groupedIds = new Set(grouped.flatMap((entry) => [...entry.ids]));
  const remaining = Object.fromEntries(
    Object.entries(definitions).filter(([id]) => !groupedIds.has(id)),
  );

  return {
    definitions: remaining,
    templates: grouped.map((entry) => entry.template),
  };
}

function axisSubsets(axes: string[]): string[][] {
  const subsets: string[][] = [];
  const total = 1 << axes.length;
  for (let mask = 0; mask < total; mask += 1) {
    const subset = axes.filter((_, index) => (mask & (1 << index)) !== 0);
    if (subset.length < axes.length) {
      subsets.push(subset);
    }
  }
  return subsets;
}

function groupKey(when: Record<string, string>, axes: string[]): string {
  return JSON.stringify(
    Object.fromEntries(axes.map((axis) => [axis, when[axis]])),
  );
}

function groupWhen(
  when: Record<string, string>,
  axes: string[],
): Record<string, string> | undefined {
  if (axes.length === 0) {
    return undefined;
  }
  return Object.fromEntries(axes.map((axis) => [axis, when[axis]]));
}

function remainingAxes(allAxes: string[], groupAxes: string[]): string[] {
  const groupAxisSet = new Set(groupAxes);
  return allAxes.filter((axis) => !groupAxisSet.has(axis));
}

function collectValueKeys(valuesByIndex: Record<string, unknown>[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const values of valuesByIndex) {
    for (const key of Object.keys(values)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

function templateNameFromWhen(
  when: Record<string, string> | undefined,
  used: Set<string>,
): string {
  if (!when || Object.keys(when).length === 0) {
    return uniqueName("allVariants", used);
  }
  return uniqueName(toCamelCase(Object.entries(when).flat(), "template"), used);
}

interface VariantCandidate {
  templates: PseudocodeTemplate[];
  variantGroups: PseudocodeVariantGroup[];
  score: number;
}

function buildVariantCandidate(
  variants: ComponentSetSpec["variants"],
  variantAxes: Record<string, string[]>,
  groupAxes: string[],
): VariantCandidate {
  const allAxes = Object.keys(variantAxes);
  const caseAxes = remainingAxes(allAxes, groupAxes);
  const groups = new Map<string, ComponentSetSpec["variants"]>();

  for (const variant of variants) {
    const key = groupKey(variant.when, groupAxes);
    groups.set(key, [...(groups.get(key) ?? []), variant]);
  }

  const usedNames = new Set<string>();
  const templates: PseudocodeTemplate[] = [];
  const variantGroups: PseudocodeVariantGroup[] = [];

  for (const group of groups.values()) {
    const when = groupWhen(group[0].when, groupAxes);
    const template = buildTemplate(group.map((variant) => variant.layout));
    const name = templateNameFromWhen(when, usedNames);
    const valueKeys = collectValueKeys(template.valuesByIndex);

    templates.push({
      name,
      when,
      variables: template.variables,
      layout: template.value,
    });

    variantGroups.push({
      template: name,
      when,
      axes: caseAxes,
      values: valueKeys,
      rows: group.map((variant, index) => [
        ...caseAxes.map((axis) => variant.when[axis]),
        ...valueKeys.map((key) => template.valuesByIndex[index][key]),
      ]),
    });
  }

  const score = JSON.stringify({ templates, variantGroups }, null, 2).length;
  return { templates, variantGroups, score };
}

function inferVariantTemplates(
  variants: ComponentSetSpec["variants"],
  variantAxes: Record<string, string[]>,
): {
  templates: PseudocodeTemplate[];
  variantGroups: PseudocodeVariantGroup[];
} {
  const axes = Object.keys(variantAxes);
  if (axes.length === 0 || variants.length === 0) {
    const candidate = buildVariantCandidate(variants, variantAxes, []);
    return {
      templates: candidate.templates,
      variantGroups: candidate.variantGroups,
    };
  }

  const candidates = axisSubsets(axes).map((subset) =>
    buildVariantCandidate(variants, variantAxes, subset),
  );
  const best = candidates.sort((left, right) => left.score - right.score)[0];
  return {
    templates: best.templates,
    variantGroups: best.variantGroups,
  };
}

export function buildPseudocodeModelFromSpec(
  spec: ComponentSetSpec,
): PseudocodeModel {
  const deduped = dedupeVariantNodes(spec.variants);
  const definitions = compressDefinitionTemplates(deduped.definitions);
  const variants = inferVariantTemplates(deduped.variants, spec.variantAxes);

  return {
    name: spec.name,
    props: spec.props,
    baseVariant: spec.baseVariant,
    variantAxes: spec.variantAxes,
    definitions: definitions.definitions,
    definitionTemplates: definitions.templates,
    templates: variants.templates,
    variantGroups: variants.variantGroups,
    stats: {
      variants: spec.variants.length,
      definitions: Object.keys(definitions.definitions).length,
      definitionTemplates: definitions.templates.length,
      templates: variants.templates.length,
      variantGroups: variants.variantGroups.length,
    },
  };
}
