import {
  extractGeometryFromNode,
  extractVisualsFromNode,
} from "../component-set-pseudocode/universal.js";
import { readString } from "../component-set-spec/figma-node.js";
import { normalizePropName } from "../component-set-spec/prop-name.js";
import { slimNode } from "../component-set-spec/slim-node.js";
import type { SlimNode } from "../component-set-spec/types.js";
import { loadVariableRegistry } from "../component-set-spec/variable-registry.js";
import {
  fingerprintContractSurface,
  fingerprintContracts,
  fingerprintTree,
} from "../contract/fingerprint.js";
import { FigmaInspectError } from "../errors.js";
import { fetchFileNodeEntry } from "../fetch-file-node-entry.js";
import type { DocumentNode, FileNodeEntry } from "../schemas.js";
import {
  collectNodeContractDependencies,
  readComponentPropertyDefinitions,
} from "./dependencies.js";
import { assertNodeContractRoot } from "./node-kind.js";
import { nodeContractArtifactFileName } from "./paths.js";
import { resolveSlimNodeTokens } from "./tokens.js";
import type {
  BuildNodeContractOptions,
  NodeContractKind,
  NodeContractMeta,
  NodeContractResult,
  NodeContractSource,
} from "./types.js";

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_");
}

function nodeName(node: DocumentNode, fallbackNodeId: string): string {
  return sanitizeFileName(readString(node, "name") ?? fallbackNodeId);
}

function childKeySegment(child: SlimNode, fallback: string): string {
  if (child.name && child.name.length > 0) {
    return normalizePropName(child.name);
  }
  if (child.component && typeof child.component !== "string") {
    return normalizePropName(child.component.name ?? fallback);
  }
  if (typeof child.component === "string") {
    return normalizePropName(child.component);
  }
  return normalizePropName(child.type || fallback);
}

function scopedChildKey(
  parentKey: string,
  segment: string,
  siblingCounts: Map<string, number>,
): string {
  const nextCount = (siblingCounts.get(segment) ?? 0) + 1;
  siblingCounts.set(segment, nextCount);
  const uniqueSegment = nextCount === 1 ? segment : `${segment}${nextCount}`;
  return parentKey === "root" ? uniqueSegment : `${parentKey}.${uniqueSegment}`;
}

function collectBundles(
  node: SlimNode,
  key = "root",
  visuals: Record<string, unknown> = {},
  geometry: Record<string, unknown> = {},
): { visuals: Record<string, unknown>; geometry: Record<string, unknown> } {
  const nodeVisuals = extractVisualsFromNode(node);
  if (Object.keys(nodeVisuals).length > 0) {
    visuals[key] = nodeVisuals;
  }

  const nodeGeometry = extractGeometryFromNode(node);
  if (Object.keys(nodeGeometry).length > 0) {
    geometry[key] = nodeGeometry;
  }

  const siblingCounts = new Map<string, number>();
  for (const [index, child] of (node.children ?? []).entries()) {
    const childKey = scopedChildKey(
      key,
      childKeySegment(child, `child${index + 1}`),
      siblingCounts,
    );
    collectBundles(child, childKey, visuals, geometry);
  }

  return { visuals, geometry };
}

function formatComponentRef(node: SlimNode): string | undefined {
  if (!node.component) {
    return undefined;
  }
  if (typeof node.component === "string") {
    return ` component ${JSON.stringify(node.component)}`;
  }
  return ` component ${JSON.stringify(node.component.name ?? node.component.id ?? "instance")}`;
}

function renderTreeNode(
  lines: string[],
  node: SlimNode,
  key: string,
  level: number,
): void {
  const indent = "  ".repeat(level);
  const name = node.name ? ` ${JSON.stringify(node.name)}` : "";
  const component = formatComponentRef(node) ?? "";
  const refs: string[] = [];
  if (
    extractVisualsFromNode(node) &&
    Object.keys(extractVisualsFromNode(node)).length > 0
  ) {
    refs.push(`style ${key}`);
  }
  if (
    extractGeometryFromNode(node) &&
    Object.keys(extractGeometryFromNode(node)).length > 0
  ) {
    refs.push(`layout ${key}`);
  }

  const children = node.children ?? [];
  if (children.length === 0 && refs.length === 0) {
    lines.push(`${indent}${node.type} ${key}${name}${component}`);
    return;
  }

  lines.push(`${indent}${node.type} ${key}${name}${component} {`);
  for (const ref of refs) {
    lines.push(`${indent}  ${ref}`);
  }

  const siblingCounts = new Map<string, number>();
  for (const [index, child] of children.entries()) {
    const childKey = scopedChildKey(
      key,
      childKeySegment(child, `child${index + 1}`),
      siblingCounts,
    );
    renderTreeNode(lines, child, childKey, level + 1);
  }
  lines.push(`${indent}}`);
}

function renderNodeStructureDsl(options: {
  nodeName: string;
  kind: NodeContractKind;
  root: SlimNode;
  format: "json" | "yaml";
}): string {
  const lines = [
    `node ${options.kind} ${JSON.stringify(options.nodeName)}`,
    "",
    "contracts {",
    `  visuals ${nodeContractArtifactFileName(options.nodeName, options.kind, "visuals", options.format)}`,
    `  geometry ${nodeContractArtifactFileName(options.nodeName, options.kind, "geometry", options.format)}`,
    `  meta ${nodeContractArtifactFileName(options.nodeName, options.kind, "meta", options.format)}`,
    "}",
    "",
    "resolve {",
    "  scheme = visuals",
    "  geometry = geometry",
    "}",
    "",
    "tree {",
  ];
  renderTreeNode(lines, options.root, "root", 1);
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function buildNodeContractLock(input: {
  kind: NodeContractKind;
  source: NodeContractSource;
  tree: DocumentNode;
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
  meta: NodeContractMeta;
  structureDsl: string;
}) {
  return {
    version: 2 as const,
    kind: input.kind,
    source: input.source,
    fingerprints: {
      tree: fingerprintTree(input.tree),
      contractSurface: fingerprintContractSurface(input.tree),
      contracts: fingerprintContracts(
        input.visuals,
        input.geometry,
        input.meta,
        input.structureDsl,
      ),
    },
    dependencies: input.meta.dependencies,
  };
}

export async function buildNodeContractFromEntry(options: {
  entry: FileNodeEntry;
  fileKey: string;
  nodeId: string;
  sourceUrl?: string;
  variablesPath?: string;
  format?: "json" | "yaml";
}): Promise<NodeContractResult> {
  const { node, kind } = assertNodeContractRoot(options.entry, options.nodeId);
  const nodeContractName = nodeName(node, options.nodeId);
  const slim = slimNode(node, { propIdToName: new Map() });
  if (!slim) {
    throw new FigmaInspectError(
      `Cannot build slim tree for node ${options.nodeId}.`,
    );
  }

  const resolvedSlim = options.variablesPath
    ? resolveSlimNodeTokens(
        slim,
        await loadVariableRegistry(options.variablesPath),
      )
    : slim;
  const { visuals, geometry } = collectBundles(resolvedSlim);
  const dependencies = collectNodeContractDependencies(
    options.entry,
    node,
    options.fileKey,
  );
  const source: NodeContractSource = {
    fileKey: options.fileKey,
    nodeId: node.id ?? options.nodeId,
    nodeType: node.type,
    name: readString(node, "name") ?? options.nodeId,
    ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
  };
  const componentProperties =
    kind === "component" ? readComponentPropertyDefinitions(node) : undefined;
  const meta: NodeContractMeta = {
    version: 1,
    kind,
    node: {
      id: source.nodeId,
      name: source.name,
      type: source.nodeType,
    },
    ...(componentProperties ? { componentProperties } : {}),
    dependencies,
  };
  const format = options.format ?? "yaml";
  const structureDsl = renderNodeStructureDsl({
    nodeName: nodeContractName,
    kind,
    root: resolvedSlim,
    format,
  });
  const lock = buildNodeContractLock({
    kind,
    source,
    tree: node,
    visuals,
    geometry,
    meta,
    structureDsl,
  });

  return {
    nodeName: nodeContractName,
    kind,
    source,
    rawNode: node,
    visuals,
    geometry,
    meta,
    structureDsl,
    lock,
  };
}

export async function buildNodeContractFromRef(
  options: BuildNodeContractOptions,
): Promise<NodeContractResult> {
  const entry = await fetchFileNodeEntry({
    token: options.token,
    fileKey: options.fileKey,
    nodeId: options.nodeId,
    fetchImpl: options.fetchImpl,
  });

  return buildNodeContractFromEntry({
    entry,
    fileKey: options.fileKey,
    nodeId: options.nodeId,
    sourceUrl: options.sourceUrl,
    variablesPath: options.variablesPath,
    format: options.format,
  });
}
