import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadRenderedImage,
  getFileImageUrls,
} from "../../figma-api/get-file-images.js";
import { readString } from "../component-set-spec/figma-node.js";
import { serializeContractData } from "../contract/contract-format.js";
import { FigmaInspectError } from "../errors.js";
import type { NodeContractKind } from "../node-contract/types.js";
import type { DocumentNode } from "../schemas.js";
import {
  assertPositiveScale,
  normalizeRenderedImageBytes,
  type RenderedImageFormat,
} from "./rendered-image-bytes.js";

export const DEFAULT_NESTED_ASSET_SCALE = 2;

export type NestedAssetFormat = RenderedImageFormat;

const NESTED_ASSET_NODE_TYPES = [
  "BOOLEAN_OPERATION",
  "COMPONENT",
  "COMPONENT_SET",
  "FRAME",
  "GROUP",
  "INSTANCE",
  "VECTOR",
] as const;

export type NestedAssetNodeType = (typeof NESTED_ASSET_NODE_TYPES)[number];

const NESTED_ASSET_NODE_TYPE_VALUES: ReadonlySet<string> = new Set(
  NESTED_ASSET_NODE_TYPES,
);

type NestedAssetTypeReason =
  (typeof NESTED_ASSET_TYPE_REASONS)[NestedAssetNodeType];
type NestedAssetReason =
  | NestedAssetTypeReason
  | "name:visual-keyword"
  | "selection:explicit-node-id"
  | "selection:include-regex";

const NESTED_ASSET_TYPE_REASONS = {
  BOOLEAN_OPERATION: "type:boolean_operation",
  COMPONENT: "type:component",
  COMPONENT_SET: "type:component_set",
  FRAME: "type:frame",
  GROUP: "type:group",
  INSTANCE: "type:instance",
  VECTOR: "type:vector",
} as const satisfies Record<NestedAssetNodeType, `type:${string}`>;

export function isNestedAssetNodeType(
  value: string,
): value is NestedAssetNodeType {
  return NESTED_ASSET_NODE_TYPE_VALUES.has(value);
}

export function supportedNestedAssetNodeTypes(): readonly NestedAssetNodeType[] {
  return NESTED_ASSET_NODE_TYPES;
}

export interface NestedAssetsOptions {
  nodeIds: readonly string[];
  includeRegex?: string;
  nodeTypes?: readonly NestedAssetNodeType[];
  maxAssets?: number;
  formats: readonly NestedAssetFormat[];
  scale: number;
}

export interface ExportNestedAssetsOptions {
  token: string;
  fileKey: string;
  root: DocumentNode;
  baseName: string;
  kind: "component-set" | NodeContractKind;
  outputDir: string;
  nestedAssets: NestedAssetsOptions;
  fetchImpl?: typeof fetch;
}

export interface ExportNestedAssetsResult {
  nestedAssetsDir: string;
  nestedAssetsManifestPath: string;
  manifest: NestedAssetsManifest;
}

interface NodeRecord {
  nodeId: string;
  name: string;
  type: string;
  nodePath: string;
  order: number;
}

interface SelectedNodeRecord extends NodeRecord {
  reasons: NestedAssetReason[];
}

interface NestedAssetCandidate {
  nodeId: string;
  name: string;
  type: string;
  nodePath: string;
  reasons: NestedAssetReason[];
  selected: boolean;
}

interface NestedAssetFile {
  format: NestedAssetFormat;
  path: string;
  scale?: number;
}

interface NestedAssetExport {
  nodeId: string;
  name: string;
  type: string;
  nodePath: string;
  reasons: NestedAssetReason[];
  files: NestedAssetFile[];
}

interface NestedAssetWarning {
  nodeId?: string;
  message: string;
}

interface NestedAssetsManifest {
  version: 1;
  kind: "nested-assets";
  source: {
    fileKey: string;
    nodeId: string;
    nodeName: string;
    nodeType: string;
    nodePath: string;
    contractKind: "component-set" | NodeContractKind;
  };
  criteria: {
    explicitNodeIds: string[];
    includeRegex?: string;
    nodeTypes: NestedAssetNodeType[];
    formats: NestedAssetFormat[];
    scale: number;
    maxAssets?: number;
  };
  candidates: NestedAssetCandidate[];
  exports: NestedAssetExport[];
  warnings: NestedAssetWarning[];
}

const VISUAL_NAME_PATTERN =
  /\b(icon|logo|asset|image|illustration|avatar|photo|thumb|thumbnail|badge|mark|glyph|symbol|spinner|loader)\b/i;
const GENERIC_NAME_PATTERN =
  /^(vector|rectangle|ellipse|line|path|group|frame|mask|union|subtract|intersect|exclude|boolean|shape)(\s*\d+)?$/i;

function normalizeFormats(
  formats: readonly NestedAssetFormat[],
): NestedAssetFormat[] {
  return [...new Set(formats)];
}

function normalizeNodeTypes(
  nodeTypes: readonly NestedAssetNodeType[] | undefined,
): NestedAssetNodeType[] {
  const values = nodeTypes?.length ? nodeTypes : NESTED_ASSET_NODE_TYPES;
  return [...new Set(values)].sort();
}

function compileIncludeRegex(pattern: string | undefined): RegExp | undefined {
  if (!pattern) {
    return undefined;
  }

  try {
    return new RegExp(pattern, "i");
  } catch (error) {
    if (error instanceof Error) {
      throw new FigmaInspectError(
        `Invalid nested asset include regex: ${error.message}`,
      );
    }

    throw error;
  }
}

function addReason(
  reasons: NestedAssetReason[],
  reason: NestedAssetReason,
): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function addReasons(
  reasons: NestedAssetReason[],
  next: readonly NestedAssetReason[],
): void {
  for (const reason of next) {
    addReason(reasons, reason);
  }
}

function collectNodeRecords(root: DocumentNode): NodeRecord[] {
  const records: NodeRecord[] = [];
  let order = 0;

  function visit(node: DocumentNode, pathSegments: string[]): void {
    const name = readString(node, "name") ?? "Untitled";
    const type = readString(node, "type") ?? "UNKNOWN";
    const nodeId = readString(node, "id");
    const nextPath = [...pathSegments, name];

    if (nodeId) {
      records.push({
        nodeId,
        name,
        type,
        nodePath: nextPath.join(" / "),
        order,
      });
      order += 1;
    }

    for (const child of node.children ?? []) {
      visit(child, nextPath);
    }
  }

  visit(root, []);
  return records;
}

function heuristicReasons(
  record: NodeRecord,
  allowedTypes: ReadonlySet<NestedAssetNodeType>,
): NestedAssetReason[] {
  if (!isNestedAssetNodeType(record.type) || !allowedTypes.has(record.type)) {
    return [];
  }

  const reasons: NestedAssetReason[] = [];
  if (
    record.type === "INSTANCE" ||
    record.type === "COMPONENT" ||
    record.type === "COMPONENT_SET"
  ) {
    reasons.push(NESTED_ASSET_TYPE_REASONS[record.type]);
  } else if (!GENERIC_NAME_PATTERN.test(record.name)) {
    reasons.push(NESTED_ASSET_TYPE_REASONS[record.type]);
  }

  if (
    VISUAL_NAME_PATTERN.test(record.name) ||
    VISUAL_NAME_PATTERN.test(record.nodePath)
  ) {
    reasons.push("name:visual-keyword");
  }

  return reasons;
}

function regexMatches(record: NodeRecord, regex: RegExp): boolean {
  return regex.test(record.name) || regex.test(record.nodePath);
}

function selectRecords(options: {
  records: NodeRecord[];
  nestedAssets: NestedAssetsOptions;
  rootNodeId: string;
  allowedTypes: ReadonlySet<NestedAssetNodeType>;
  includeRegex: RegExp | undefined;
}): {
  selected: SelectedNodeRecord[];
  candidates: NestedAssetCandidate[];
  warnings: NestedAssetWarning[];
} {
  const byId = new Map(
    options.records.map((record) => [record.nodeId, record]),
  );
  const selected = new Map<string, SelectedNodeRecord>();
  const candidateReasons = new Map<string, NestedAssetReason[]>();
  const warnings: NestedAssetWarning[] = [];

  function reasonsForCandidate(record: NodeRecord): NestedAssetReason[] {
    const existing = candidateReasons.get(record.nodeId);
    if (existing) {
      return existing;
    }

    const reasons: NestedAssetReason[] = [];
    candidateReasons.set(record.nodeId, reasons);
    return reasons;
  }

  function addCandidate(
    record: NodeRecord,
    reasons: readonly NestedAssetReason[],
  ): void {
    addReasons(reasonsForCandidate(record), reasons);
  }

  function addSelected(
    record: NodeRecord,
    reasons: readonly NestedAssetReason[],
  ): void {
    const existing = selected.get(record.nodeId);
    if (existing) {
      addReasons(existing.reasons, reasons);
      return;
    }

    selected.set(record.nodeId, { ...record, reasons: [...reasons] });
  }

  for (const record of options.records) {
    if (record.nodeId === options.rootNodeId) {
      continue;
    }

    const reasons = heuristicReasons(record, options.allowedTypes);
    if (reasons.length > 0) {
      addCandidate(record, reasons);
    }

    if (
      options.includeRegex &&
      isNestedAssetNodeType(record.type) &&
      options.allowedTypes.has(record.type) &&
      regexMatches(record, options.includeRegex)
    ) {
      const selectionReasons = ["selection:include-regex"] as const;
      addCandidate(record, selectionReasons);
      addSelected(record, selectionReasons);
    }
  }

  for (const nodeId of options.nestedAssets.nodeIds) {
    const record = byId.get(nodeId);
    if (!record) {
      throw new FigmaInspectError(
        `Nested asset node ${nodeId} was not found under the exported node.`,
      );
    }

    const reasons = ["selection:explicit-node-id"] as const;
    addCandidate(record, reasons);
    addSelected(record, reasons);
  }

  let selectedRecords = [...selected.values()].sort(
    (left, right) => left.order - right.order,
  );
  const maxAssets = options.nestedAssets.maxAssets;
  if (maxAssets !== undefined && selectedRecords.length > maxAssets) {
    const omitted = selectedRecords.slice(maxAssets);
    selectedRecords = selectedRecords.slice(0, maxAssets);
    for (const record of omitted) {
      warnings.push({
        nodeId: record.nodeId,
        message: `Skipped by --asset-max ${maxAssets}.`,
      });
    }
  }

  const selectedIds = new Set(selectedRecords.map((record) => record.nodeId));
  const candidates = [...candidateReasons.entries()]
    .map(([nodeId, reasons]) => {
      const record = byId.get(nodeId);
      if (!record) {
        throw new FigmaInspectError(
          `Nested asset candidate ${nodeId} disappeared during selection.`,
        );
      }

      return {
        nodeId,
        name: record.name,
        type: record.type,
        nodePath: record.nodePath,
        reasons,
        selected: selectedIds.has(nodeId),
        order: record.order,
      };
    })
    .sort((left, right) => left.order - right.order)
    .map(({ order: _order, ...candidate }) => candidate);

  return { selected: selectedRecords, candidates, warnings };
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function assetFileName(
  record: SelectedNodeRecord,
  index: number,
  format: NestedAssetFormat,
): string {
  const order = String(index + 1).padStart(3, "0");
  const pathSlug = slug(record.nodePath);
  const idSlug = slug(record.nodeId) || "node";
  return `${order}-${pathSlug || "asset"}-${idSlug}.${format}`;
}

function nestedAssetsManifestPath(
  outputDir: string,
  baseName: string,
  kind: "component-set" | NodeContractKind,
): string {
  return path.join(outputDir, `${baseName}.${kind}.nested-assets.yaml`);
}

async function exportFiles(options: {
  token: string;
  fileKey: string;
  outputDir: string;
  baseName: string;
  selected: SelectedNodeRecord[];
  formats: NestedAssetFormat[];
  scale: number;
  fetchImpl?: typeof fetch;
}): Promise<NestedAssetExport[]> {
  const assetsDir = path.join(options.outputDir, `${options.baseName}.assets`);
  await mkdir(assetsDir, { recursive: true });

  const exported: NestedAssetExport[] = options.selected.map((record) => ({
    nodeId: record.nodeId,
    name: record.name,
    type: record.type,
    nodePath: record.nodePath,
    reasons: record.reasons,
    files: [],
  }));

  for (const format of options.formats) {
    const imageUrls = await getFileImageUrls({
      token: options.token,
      fileKey: options.fileKey,
      nodeIds: options.selected.map((record) => record.nodeId),
      format,
      scale: format === "png" ? options.scale : undefined,
      fetchImpl: options.fetchImpl,
    });

    for (let index = 0; index < options.selected.length; index += 1) {
      const record = options.selected[index];
      const entry = exported[index];
      const fileName = assetFileName(record, index, format);
      const relativePath = path.posix.join(
        `${options.baseName}.assets`,
        fileName,
      );
      const absolutePath = path.join(options.outputDir, relativePath);
      const rawBytes = await downloadRenderedImage(
        imageUrls[record.nodeId],
        options.fetchImpl,
      );

      await writeFile(
        absolutePath,
        normalizeRenderedImageBytes(
          rawBytes,
          format,
          record.nodeId,
          "nested asset",
        ),
      );

      entry.files.push({
        format,
        path: relativePath,
        ...(format === "png" ? { scale: options.scale } : {}),
      });
    }
  }

  return exported;
}

export async function exportNestedAssets(
  options: ExportNestedAssetsOptions,
): Promise<ExportNestedAssetsResult> {
  const formats = normalizeFormats(options.nestedAssets.formats);
  if (formats.length === 0) {
    throw new FigmaInspectError(
      "Nested asset export requires at least one format.",
    );
  }

  if (formats.includes("png")) {
    assertPositiveScale(options.nestedAssets.scale, "Nested asset scale");
  }

  if (
    options.nestedAssets.nodeIds.length === 0 &&
    !options.nestedAssets.includeRegex
  ) {
    throw new FigmaInspectError(
      "Nested asset export requires --asset-node-id or --asset-include-regex.",
    );
  }

  const rootNodeId = readString(options.root, "id");
  const rootNodeName = readString(options.root, "name") ?? options.baseName;
  const rootNodeType = readString(options.root, "type") ?? "UNKNOWN";
  if (!rootNodeId) {
    throw new FigmaInspectError("Exported node has no Figma node id.");
  }

  const records = collectNodeRecords(options.root);
  const rootRecord = records.find((record) => record.nodeId === rootNodeId);
  if (!rootRecord) {
    throw new FigmaInspectError("Exported node was not collected for export.");
  }
  const nodeTypes = normalizeNodeTypes(options.nestedAssets.nodeTypes);
  const allowedTypes = new Set(nodeTypes);
  const includeRegex = compileIncludeRegex(options.nestedAssets.includeRegex);
  const { selected, candidates, warnings } = selectRecords({
    records,
    nestedAssets: options.nestedAssets,
    rootNodeId,
    allowedTypes,
    includeRegex,
  });

  if (selected.length === 0) {
    throw new FigmaInspectError(
      "Nested asset selection matched no nodes under the exported node.",
    );
  }

  const exported = await exportFiles({
    token: options.token,
    fileKey: options.fileKey,
    outputDir: options.outputDir,
    baseName: options.baseName,
    selected,
    formats,
    scale: options.nestedAssets.scale,
    fetchImpl: options.fetchImpl,
  });

  const manifest: NestedAssetsManifest = {
    version: 1,
    kind: "nested-assets",
    source: {
      fileKey: options.fileKey,
      nodeId: rootNodeId,
      nodeName: rootNodeName,
      nodeType: rootNodeType,
      nodePath: rootRecord.nodePath,
      contractKind: options.kind,
    },
    criteria: {
      explicitNodeIds: [...options.nestedAssets.nodeIds],
      ...(options.nestedAssets.includeRegex
        ? { includeRegex: options.nestedAssets.includeRegex }
        : {}),
      nodeTypes,
      formats,
      scale: options.nestedAssets.scale,
      ...(options.nestedAssets.maxAssets !== undefined
        ? { maxAssets: options.nestedAssets.maxAssets }
        : {}),
    },
    candidates,
    exports: exported,
    warnings,
  };

  const manifestPath = nestedAssetsManifestPath(
    options.outputDir,
    options.baseName,
    options.kind,
  );
  await writeFile(
    manifestPath,
    serializeContractData(manifest, "yaml"),
    "utf8",
  );

  return {
    nestedAssetsDir: path.join(options.outputDir, `${options.baseName}.assets`),
    nestedAssetsManifestPath: manifestPath,
    manifest,
  };
}
