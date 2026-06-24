import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  filterFileComponentsForComponentSet,
  getComponentSetByKey,
  listFileComponents,
} from "../figma-api/index.js";
import { readString } from "../inspect/component-set-spec/figma-node.js";
import type { TeamComponentEntry } from "../inspect/component-set-spec/team-component-registry.js";
import {
  type ContractFormat,
  contractArtifactFileName,
  serializeContractData,
} from "../inspect/contract/contract-format.js";
import {
  buildContractLock,
  collectUnchangedVariantNodeIds,
  readContractLock,
  resolveContractLockPath,
  stabilizeContractLockDates,
  toLockVariants,
  writeContractLock,
} from "../inspect/contract/contract-lock.js";
import {
  readComponentContractArtifacts,
  validateComponentContractArtifacts,
} from "../inspect/contract/contract-schema.js";
import {
  fingerprintAssetFiles,
  fingerprintContractSurface,
  fingerprintContracts,
  fingerprintTree,
} from "../inspect/contract/fingerprint.js";
import { FigmaInspectError } from "../inspect/errors.js";
import {
  buildComponentSetPseudocodeFromRaw,
  type ExportPreviewOptions,
  exportNestedAssets,
  exportNodePreview,
  exportVariantAssets,
  layoutRisksForTree,
  loadComponentSetContext,
  type NestedAssetsOptions,
  resolveTeamComponentSetScope,
} from "../inspect/index.js";
import type {
  ComponentSetTarget,
  FigmaTeamComponentSet,
} from "../inspect/types.js";
import type {
  ExportArtifactPathExtras,
  ExportArtifactPaths,
} from "./export-result.js";

export interface ExportComponentSetOptions {
  token: string;
  teamId: string;
  outputDir: string;
  componentSet: ComponentSetTarget;
  sourceUrl?: string;
  variablesPath: string;
  exportAssets?: boolean;
  assetFormat?: "svg";
  nestedAssets?: NestedAssetsOptions;
  preview?: ExportPreviewOptions;
  format?: ContractFormat;
}

export interface ExportComponentSetResult
  extends ExportArtifactPaths,
    ExportArtifactPathExtras {}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_");
}

function dataFileExtension(format: ContractFormat): string {
  return format === "json" ? ".json" : ".yaml";
}

function teamComponentEntryFromPublishedSet(
  publishedSet: FigmaTeamComponentSet,
): TeamComponentEntry {
  return {
    id: publishedSet.id,
    key: publishedSet.key,
    name: publishedSet.name,
    fileKey: publishedSet.fileKey,
    projectId: publishedSet.projectId,
  };
}

async function writeDataFile(
  filePath: string,
  value: unknown,
  format: ContractFormat,
): Promise<void> {
  await writeFile(filePath, serializeContractData(value, format), "utf8");
}

async function writeImportNotes(options: {
  outputDir: string;
  sourceUrl: string | undefined;
  fileKey: string;
  nodeId: string;
  componentSetKey: string;
  componentSetName: string;
}): Promise<string | undefined> {
  if (!options.sourceUrl) {
    return undefined;
  }

  const notesPath = path.join(options.outputDir, "import-notes.md");
  const lines = [
    "# Import Notes",
    "",
    `sourceUrl: ${JSON.stringify(options.sourceUrl)}`,
    `fileKey: ${JSON.stringify(options.fileKey)}`,
    `nodeId: ${JSON.stringify(options.nodeId)}`,
    `componentSetKey: ${JSON.stringify(options.componentSetKey)}`,
    `componentSetName: ${JSON.stringify(options.componentSetName)}`,
    "",
  ];
  await writeFile(notesPath, lines.join("\n"), "utf8");

  return notesPath;
}

function isAssetExportabilityError(error: unknown): error is FigmaInspectError {
  return (
    error instanceof FigmaInspectError &&
    error.message.startsWith("Component set is not asset-exportable:")
  );
}

export async function exportComponentSet(
  options: ExportComponentSetOptions,
): Promise<ExportComponentSetResult> {
  const scope = await resolveTeamComponentSetScope({
    token: options.token,
    teamId: options.teamId,
    componentSet: options.componentSet,
  });

  const [context, componentSetMeta, fileComponents] = await Promise.all([
    loadComponentSetContext({
      token: options.token,
      ...scope,
    }),
    getComponentSetByKey({
      token: options.token,
      componentSetKey: scope.publishedSet.key,
    }),
    listFileComponents({
      token: options.token,
      fileKey: scope.fileKey,
    }),
  ]);

  const raw = context.tree;
  const baseName = sanitizeFileName(scope.publishedSet.name);
  const componentSetNodeId = readString(raw, "id") ?? componentSetMeta.node_id;

  await mkdir(options.outputDir, { recursive: true });

  const format = options.format ?? "yaml";
  const visualsContractPath = path.join(
    options.outputDir,
    contractArtifactFileName(baseName, "visuals", format),
  );
  const geometryContractPath = path.join(
    options.outputDir,
    contractArtifactFileName(baseName, "geometry", format),
  );
  const metaContractPath = path.join(
    options.outputDir,
    contractArtifactFileName(baseName, "meta", format),
  );
  const lockContractPath = resolveContractLockPath(options.outputDir, baseName);
  const structureDslPath = path.join(
    options.outputDir,
    `${baseName}.component-set.structure.dsl`,
  );
  const layoutRisks = layoutRisksForTree(raw);
  const layoutRisksPath =
    layoutRisks.length > 0
      ? path.join(
          options.outputDir,
          `${baseName}.component-set.layout-risks${dataFileExtension(format)}`,
        )
      : undefined;

  const lockVariants = toLockVariants(
    filterFileComponentsForComponentSet(fileComponents, componentSetNodeId),
  );
  const previousLock = await readContractLock(lockContractPath);
  const treeFingerprint = fingerprintTree(raw);
  const contractSurfaceFingerprint = fingerprintContractSurface(raw);
  const skipNodeIds = collectUnchangedVariantNodeIds(
    previousLock,
    lockVariants,
    treeFingerprint,
    contractSurfaceFingerprint,
  );

  let assetsDir: string | undefined;
  let exportedAssets:
    | Awaited<ReturnType<typeof exportVariantAssets>>
    | undefined;
  let assetExportWarning: string | undefined;

  if (options.exportAssets) {
    try {
      exportedAssets = await exportVariantAssets({
        token: options.token,
        fileKey: scope.fileKey,
        componentSet: raw,
        baseName,
        outputDir: options.outputDir,
        format: options.assetFormat ?? "svg",
        skipNodeIds,
      });
      assetsDir = exportedAssets.assetsDir;
    } catch (error) {
      if (!isAssetExportabilityError(error)) {
        throw error;
      }

      assetExportWarning = [
        `Variant SVG assets skipped for ${baseName}: ${error.message}`,
        "Component contract was exported as a runtime contract.",
        "Use --export-nested-assets with --asset-node-id when a slot/default nested icon asset is needed.",
      ].join(" ");
    }
  }

  const previewPath = options.preview
    ? (
        await exportNodePreview({
          token: options.token,
          fileKey: scope.fileKey,
          nodeId: componentSetNodeId,
          baseName,
          kind: "component-set",
          outputDir: options.outputDir,
          preview: options.preview,
        })
      ).previewPath
    : undefined;
  const nestedAssetsResult = options.nestedAssets
    ? await exportNestedAssets({
        token: options.token,
        fileKey: scope.fileKey,
        root: raw,
        baseName,
        kind: "component-set",
        outputDir: options.outputDir,
        nestedAssets: options.nestedAssets,
      })
    : undefined;

  const contractResult = await buildComponentSetPseudocodeFromRaw(raw, {
    variablesPath: options.variablesPath,
    assetBacked: exportedAssets !== undefined,
    assets: exportedAssets?.assets,
    format,
    metaContext: {
      component: teamComponentEntryFromPublishedSet(scope.publishedSet),
      teamComponents: scope.teamComponents,
    },
  });
  validateComponentContractArtifacts(
    {
      componentName: baseName,
      visuals: contractResult.visuals,
      geometry: contractResult.geometry,
      meta: contractResult.meta,
      structureDsl: contractResult.structureDsl,
    },
    format,
  );
  await writeDataFile(visualsContractPath, contractResult.visuals, format);
  await writeDataFile(geometryContractPath, contractResult.geometry, format);
  await writeDataFile(metaContractPath, contractResult.meta, format);
  await writeFile(structureDslPath, contractResult.structureDsl, "utf8");
  if (layoutRisksPath) {
    await writeDataFile(
      layoutRisksPath,
      {
        version: 1,
        kind: "component-set-layout-risks",
        componentSet: {
          id: componentSetNodeId,
          key: componentSetMeta.key,
          name: scope.publishedSet.name,
        },
        risks: layoutRisks,
      },
      format,
    );
  }

  const artifacts = await readComponentContractArtifacts(
    options.outputDir,
    baseName,
    format,
  );
  validateComponentContractArtifacts(artifacts, format);

  const lock = stabilizeContractLockDates(
    previousLock,
    buildContractLock({
      source: {
        fileKey: scope.fileKey,
        nodeId: componentSetNodeId,
        nodeType: "COMPONENT_SET",
        ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
        componentSetKey: componentSetMeta.key,
        componentSetUpdatedAt: componentSetMeta.updated_at,
      },
      variants: lockVariants,
      fingerprints: {
        tree: treeFingerprint,
        contractSurface: contractSurfaceFingerprint,
        contracts: fingerprintContracts(
          contractResult.visuals,
          contractResult.geometry,
          contractResult.meta,
          contractResult.structureDsl,
        ),
        ...(assetsDir
          ? {
              assets: await fingerprintAssetFiles(
                assetsDir,
                exportedAssets?.assetSlugs ?? [],
              ),
            }
          : {}),
      },
    }),
  );
  await writeContractLock(lockContractPath, lock);
  const importNotesPath = await writeImportNotes({
    outputDir: options.outputDir,
    sourceUrl: options.sourceUrl,
    fileKey: scope.fileKey,
    nodeId: componentSetNodeId,
    componentSetKey: componentSetMeta.key,
    componentSetName: scope.publishedSet.name,
  });

  return {
    visualsContractPath,
    geometryContractPath,
    metaContractPath,
    lockContractPath,
    structureDslPath,
    previewPath,
    assetsDir,
    nestedAssetsDir: nestedAssetsResult?.nestedAssetsDir,
    nestedAssetsManifestPath: nestedAssetsResult?.nestedAssetsManifestPath,
    layoutRisksPath,
    importNotesPath,
    assetExportWarning,
    layoutRiskWarning:
      layoutRisks.length > 0
        ? `${baseName} has ${layoutRisks.length} layout risk${layoutRisks.length === 1 ? "" : "s"}; inspect ${layoutRisksPath}.`
        : undefined,
  };
}
