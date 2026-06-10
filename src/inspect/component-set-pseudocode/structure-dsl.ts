import type { ComponentSetPropDefinition } from "../component-set-spec/types.js";
import type { StructureContract, StructureNode } from "./structure-contract.js";

const INDENT = "  ";

function isElementNode(
  node: StructureNode,
): node is Extract<StructureNode, { type: string }> {
  return "type" in node;
}

function isUseNode(node: StructureNode): node is { $use: string } {
  return "$use" in node;
}

function isSlotNode(node: StructureNode): node is { $slot: string } {
  return "$slot" in node;
}

function formatWhenProps(props: string[] | undefined): string {
  if (!props || props.length === 0) {
    return "";
  }
  return ` when ${props.join(", ")}`;
}

function formatWhenAxes(when: Record<string, string> | undefined): string {
  if (!when || Object.keys(when).length === 0) {
    return "";
  }
  const parts = Object.entries(when).map(
    ([axis, value]) => `${axis} = ${JSON.stringify(value)}`,
  );
  return ` when ${parts.join(", ")}`;
}

function formatPropDefinition(
  name: string,
  definition: ComponentSetPropDefinition,
): string {
  if (definition.type === "variant" && definition.options) {
    const defaultValue = String(definition.default ?? definition.options[0]);
    return `${name} variant = ${JSON.stringify(defaultValue)} // ${definition.options.map((option) => JSON.stringify(option)).join(" | ")}`;
  }
  if (definition.type === "instance") {
    return `${name} instance = ${JSON.stringify(name)}`;
  }
  if (definition.type === "boolean") {
    return `${name} boolean = ${JSON.stringify(definition.default ?? false)}`;
  }
  return `${name} text = ${JSON.stringify(definition.default ?? "")}`;
}

function renderBindings(
  lines: string[],
  level: number,
  styleRef?: string,
  layoutRef?: string,
): void {
  const indent = INDENT.repeat(level);
  if (styleRef) {
    lines.push(`${indent}style ${styleRef}`);
  }
  if (layoutRef) {
    lines.push(`${indent}layout ${layoutRef}`);
  }
}

function renderNode(lines: string[], node: StructureNode, level: number): void {
  const indent = INDENT.repeat(level);

  if (isUseNode(node)) {
    lines.push(`${indent}use ${node.$use}`);
    return;
  }

  if (isSlotNode(node)) {
    lines.push(`${indent}slot ${node.$slot}`);
    return;
  }

  if (!isElementNode(node)) {
    return;
  }

  const whenProps = node.when?.map((entry) => entry.prop);
  const header = `${node.type} ${node.key}${formatWhenProps(whenProps)}`;
  const blockComment = node.name ? ` // ${node.name}` : "";

  const extras: string[] = [];
  if (node.content !== undefined) {
    extras.push(
      typeof node.content === "string"
        ? `content ${JSON.stringify(node.content)}`
        : `content \${${node.content.$prop}}`,
    );
  }
  if (node.instance !== undefined) {
    extras.push(
      typeof node.instance === "string"
        ? `instance ${node.instance}`
        : `instance \${${node.instance.$prop}}`,
    );
  }
  if (node.asset !== undefined) {
    extras.push(`asset ${node.asset.$ref}`);
  }

  const styleRef = node.style?.$ref;
  const layoutRef = node.layout?.$ref;
  const children = node.children ?? [];
  const hasBlock =
    Boolean(styleRef || layoutRef) || extras.length > 0 || children.length > 0;

  if (!hasBlock) {
    lines.push(`${indent}${header}`);
    return;
  }

  lines.push(`${indent}${header} {${blockComment}`);
  const bodyLevel = level + 1;
  renderBindings(lines, bodyLevel, styleRef, layoutRef);
  for (const extra of extras) {
    lines.push(`${INDENT.repeat(bodyLevel)}${extra}`);
  }
  for (const child of children) {
    renderNode(lines, child, bodyLevel);
  }
  lines.push(`${indent}}`);
}

function renderResolve(contract: StructureContract): string[] {
  const axes = Object.keys(contract.variantAxes);
  if (axes.length === 0) {
    const lines = [
      "resolve {",
      `${INDENT}scheme = visuals`,
      `${INDENT}geometry = geometry`,
    ];
    if (contract.assetBacked) {
      lines.push(`${INDENT}asset = meta.assets`);
    }
    lines.push("}");
    return lines;
  }
  const path = axes.join("][");
  const lines = [
    "resolve {",
    `${INDENT}scheme = visuals[${path}]`,
    `${INDENT}geometry = geometry[${path}]`,
  ];
  if (contract.assetBacked) {
    lines.push(`${INDENT}asset = meta.assets[${path}]`);
  }
  lines.push("}");
  return lines;
}

export function renderStructureDsl(contract: StructureContract): string {
  const lines: string[] = [`component ${contract.component}`, ""];

  if (Object.keys(contract.props ?? {}).length > 0) {
    lines.push("props {");
    for (const [name, definition] of Object.entries(contract.props ?? {})) {
      lines.push(`${INDENT}${formatPropDefinition(name, definition)}`);
    }
    lines.push("}", "");
  }

  lines.push(
    "contracts {",
    `${INDENT}visuals ${contract.contracts.visuals}`,
    `${INDENT}geometry ${contract.contracts.geometry}`,
    `${INDENT}meta ${contract.contracts.meta}`,
    "}",
    "",
  );

  if (Object.keys(contract.variantAxes).length > 0) {
    lines.push("variantAxes {");
    for (const [axis, values] of Object.entries(contract.variantAxes)) {
      lines.push(`${INDENT}${axis}: ${values.join(" | ")}`);
    }
    lines.push("}", "");
  }

  lines.push(...renderResolve(contract), "");

  if (contract.dispatch.length > 0 || contract.fallback) {
    lines.push("dispatch {");
    for (const entry of contract.dispatch) {
      const whenLabel = formatWhenAxes(entry.when).replace(/^ when /, "");
      lines.push(`${INDENT}${whenLabel} => ${entry.template}`);
    }
    if (contract.fallback) {
      lines.push(`${INDENT}fallback => ${contract.fallback}`);
    }
    lines.push("}", "");
  }

  const templateNames = Object.keys(contract.templates).sort();
  if (templateNames.length > 0) {
    lines.push("templates {");
    for (let index = 0; index < templateNames.length; index += 1) {
      const name = templateNames[index];
      const template = contract.templates[name];
      lines.push(`${INDENT}template ${name}${formatWhenAxes(template.when)} {`);
      renderNode(lines, template.root, 2);
      lines.push(`${INDENT}}`);
      if (index < templateNames.length - 1) {
        lines.push("");
      }
    }
    lines.push("}");
  }

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}
