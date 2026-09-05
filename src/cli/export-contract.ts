import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type ContractFormat,
  serializeContractData,
} from "../inspect/contract/contract-format.js";
import {
  type ExportPreviewOptions,
  exportNestedAssets,
  exportNodePreview,
  FigmaInspectError,
  type NestedAssetsOptions,
  resolveExportContractTarget,
} from "../inspect/index.js";
import type { ExportContractTarget, FigmaNodeRef } from "../inspect/types.js";
import { exportComponentSet } from "./export-component-set.js";
import { exportNodeContract } from "./export-node-contract.js";
import type {
  ExportArtifactPathResult,
  ExportSectionResult,
} from "./export-result.js";

export interface ExportContractOptions extends FigmaNodeRef {
  token: string;
  teamId?: string;
  outputDir: string;
  sourceUrl?: string;
  variablesPath?: string;
  exportAssets?: boolean;
  assetFormat?: "svg";
  nestedAssets?: NestedAssetsOptions;
  preview?: ExportPreviewOptions;
  format?: ContractFormat;
}

export type ExportContractResult =
  | ExportArtifactPathResult
  | ExportSectionResult;

async function exportTarget(
  options: ExportContractOptions,
  target: ExportContractTarget,
  sourcePath?: string,
): Promise<ExportContractResult> {
  if (target.kind === "section") {
    return exportSection(options, target, sourcePath);
  }
  if (target.kind === "component-set") {
    return exportComponentSet({
      ...options,
      entry: target.entry,
      componentSet: {
        kind: "node",
        fileKey: target.fileKey,
        nodeId: target.nodeId,
      },
    });
  }
  return exportNodeContract({
    token: options.token,
    outputDir: options.outputDir,
    fileKey: target.fileKey,
    nodeId: target.nodeId,
    entry: target.entry,
    sourceUrl: options.sourceUrl,
    variablesPath: options.variablesPath,
    nestedAssets: options.nestedAssets,
    preview: options.preview,
    format: options.format,
  });
}

async function exportSection(
  options: ExportContractOptions,
  target: ExportContractTarget,
  parentSourcePath?: string,
): Promise<ExportSectionResult> {
  const node = target.entry.document;
  if (!node)
    throw new FigmaInspectError(`Section ${target.nodeId} has no document.`);
  await mkdir(options.outputDir, { recursive: true });
  const sourcePath =
    parentSourcePath ?? path.join(options.outputDir, "section.source.json");
  if (!parentSourcePath) {
    await writeFile(sourcePath, JSON.stringify(target.source), "utf8");
  }
  const format = options.format ?? "yaml";
  const indexPath = path.join(options.outputDir, `section.index.${format}`);
  const children: ExportContractResult[] = [];
  const indexChildren = [];
  for (const child of node.children ?? []) {
    if (!child.id)
      throw new FigmaInspectError("Section child is missing its node id.");
    const kind =
      child.type === "SECTION"
        ? "section"
        : child.type === "COMPONENT_SET"
          ? "component-set"
          : child.type === "FRAME" || child.type === "COMPONENT"
            ? "node"
            : undefined;
    const directory = encodeURIComponent(child.id);
    if (kind) {
      children.push(
        await exportTarget(
          {
            ...options,
            nodeId: child.id,
            outputDir: path.join(options.outputDir, directory),
            sourceUrl: undefined,
            preview: undefined,
            nestedAssets: undefined,
          },
          {
            ...target,
            kind,
            nodeId: child.id,
            entry: { ...target.entry, document: child },
          },
          sourcePath,
        ),
      );
    }
    indexChildren.push({
      id: child.id,
      name: child.name,
      type: child.type,
      bounds: child.absoluteBoundingBox,
      ...(kind ? { contractDirectory: directory } : {}),
    });
  }
  await writeFile(
    indexPath,
    serializeContractData(
      {
        version: 1,
        kind: "section",
        source: {
          fileKey: target.fileKey,
          nodeId: target.nodeId,
          name: node.name,
          sourceUrl: options.sourceUrl,
        },
        bounds: node.absoluteBoundingBox,
        sourcePath: path.relative(options.outputDir, sourcePath),
        children: indexChildren,
      },
      format,
    ),
    "utf8",
  );
  const preview = options.preview
    ? await exportNodePreview({
        ...options,
        baseName: "section",
        kind: "section",
        preview: options.preview,
      })
    : undefined;
  const nestedAssets = options.nestedAssets
    ? await exportNestedAssets({
        ...options,
        root: node,
        baseName: "section",
        kind: "section",
        nestedAssets: options.nestedAssets,
      })
    : undefined;
  return { indexPath, sourcePath, children, ...preview, ...nestedAssets };
}

export async function exportContract(
  options: ExportContractOptions,
): Promise<ExportContractResult> {
  return exportTarget(options, await resolveExportContractTarget(options));
}
