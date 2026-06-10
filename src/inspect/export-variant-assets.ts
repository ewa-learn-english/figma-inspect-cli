import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadRenderedImage,
  getFileImageUrls,
} from "../figma-api/get-file-images.js";
import type {
  AssetContractEntry,
  AssetContractMap,
} from "./component-set-pseudocode/assets-contract.js";
import { readChildren, readString } from "./component-set-spec/figma-node.js";
import { parseVariantName } from "./component-set-spec/parse-props.js";
import { collectVariantAxes } from "./component-set-spec/variant-axes.js";
import { FigmaInspectError } from "./errors.js";
import { normalizeExportedSvgBytes } from "./normalize-exported-svg.js";

interface VariantNodeRef {
  nodeId: string;
  when: Record<string, string>;
}

interface AssetBuildEntry extends AssetContractEntry {
  when: Record<string, string>;
}

export interface ExportVariantAssetsOptions {
  token: string;
  fileKey: string;
  componentSet: Record<string, unknown>;
  baseName: string;
  outputDir: string;
  format: "svg";
  fetchImpl?: typeof fetch;
}

export interface ExportVariantAssetsResult {
  assetsDir: string;
  assets: AssetContractMap;
}

function assetFileName(
  when: Record<string, string>,
  variantAxes: Record<string, string[]>,
): string {
  const orderedAxes = Object.keys(variantAxes).sort((left, right) => {
    if (left === "Size") {
      return 1;
    }
    if (right === "Size") {
      return -1;
    }
    return left.localeCompare(right);
  });
  const parts = orderedAxes
    .map((axis) => when[axis])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  if (parts.length === 0) {
    throw new FigmaInspectError("Variant asset name has no axis values.");
  }

  return `${parts.join("-")}.svg`;
}

function collectVariantNodeRefs(
  componentSet: Record<string, unknown>,
): VariantNodeRef[] {
  const variantNodes = readChildren(componentSet).filter(
    (child) => readString(child, "type") === "COMPONENT",
  );

  const refs: VariantNodeRef[] = [];
  for (const variantNode of variantNodes) {
    const nodeId = readString(variantNode, "id");
    const variantName = readString(variantNode, "name");
    if (!nodeId || !variantName) {
      continue;
    }

    const when = parseVariantName(variantName);
    if (Object.keys(when).length === 0) {
      continue;
    }

    refs.push({ nodeId, when });
  }

  if (refs.length === 0) {
    throw new FigmaInspectError("COMPONENT_SET has no exportable variants.");
  }

  return refs.sort((left, right) =>
    JSON.stringify(left.when).localeCompare(JSON.stringify(right.when)),
  );
}

function setNestedAsset(
  root: AssetContractMap,
  when: Record<string, string>,
  axes: string[],
  entry: AssetContractEntry,
): void {
  if (axes.length === 0) {
    return;
  }

  const [axis, ...rest] = axes;
  const value = when[axis ?? ""];
  if (!value) {
    return;
  }

  if (rest.length === 0) {
    root[value] = entry;
    return;
  }

  const current = root[value];
  if (typeof current !== "object" || current === null || "path" in current) {
    root[value] = {};
  }

  setNestedAsset(root[value] as AssetContractMap, when, rest, entry);
}

function buildNestedAssetMap(
  entries: AssetBuildEntry[],
  variantAxes: Record<string, string[]>,
): AssetContractMap {
  const axes = Object.keys(variantAxes);
  const root: AssetContractMap = {};

  for (const entry of entries) {
    const { when, ...asset } = entry;
    setNestedAsset(root, when, axes, asset);
  }

  return root;
}

export async function exportVariantAssets(
  options: ExportVariantAssetsOptions,
): Promise<ExportVariantAssetsResult> {
  const variantRefs = collectVariantNodeRefs(options.componentSet);
  const variantAxes = collectVariantAxes(variantRefs.map((ref) => ref.when));
  const assetsDir = path.join(options.outputDir, `${options.baseName}.assets`);
  await mkdir(assetsDir, { recursive: true });

  const imageUrls = await getFileImageUrls({
    token: options.token,
    fileKey: options.fileKey,
    nodeIds: variantRefs.map((ref) => ref.nodeId),
    format: options.format,
    fetchImpl: options.fetchImpl,
  });

  const entries: AssetBuildEntry[] = [];

  for (const ref of variantRefs) {
    const fileName = assetFileName(ref.when, variantAxes);
    const relativePath = path.posix.join(
      `${options.baseName}.assets`,
      fileName,
    );
    const absolutePath = path.join(options.outputDir, relativePath);
    const bytes = normalizeExportedSvgBytes(
      await downloadRenderedImage(imageUrls[ref.nodeId], options.fetchImpl),
    );

    await writeFile(absolutePath, bytes);

    entries.push({
      when: ref.when,
      format: options.format,
      path: relativePath,
    });
  }

  return {
    assetsDir,
    assets: buildNestedAssetMap(entries, variantAxes),
  };
}
