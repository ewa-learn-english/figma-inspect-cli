import { mkdir, readdir, writeFile } from "node:fs/promises";
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
} from "../inspect/contract-format.js";
import {
  buildContractLock,
  type ContractLockVariant,
  collectUnchangedVariantNodeIds,
  readContractLock,
  resolveContractLockPath,
  writeContractLock,
} from "../inspect/contract-lock.js";
import {
  fingerprintAssetFiles,
  fingerprintContracts,
  fingerprintTree,
} from "../inspect/fingerprint.js";
import {
  buildComponentSetPseudocodeFromRaw,
  exportVariantAssets,
  loadComponentSetContext,
  resolveTeamComponentSetScope,
} from "../inspect/index.js";
import type {
  ComponentSetLookup,
  FigmaTeamComponentSet,
} from "../inspect/types.js";

export interface ExportComponentSetOptions {
  token: string;
  teamId: string;
  outputDir: string;
  componentSet: ComponentSetLookup;
  variablesPath?: string;
  exportAssets?: boolean;
  assetFormat?: "svg";
  format?: ContractFormat;
}

export interface ExportComponentSetResult {
  visualsContractPath: string;
  geometryContractPath: string;
  metaContractPath: string;
  lockContractPath: string;
  structureDslPath: string;
  assetsContractPath?: string;
  assetsDir?: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_");
}

function resolveExportBaseName(
  componentSet: ComponentSetLookup,
  rawName: string | undefined,
): string {
  if (componentSet.kind === "name") {
    return componentSet.value;
  }

  return rawName ?? componentSet.value;
}

function teamComponentEntryFromPublishedSet(
  publishedSet: FigmaTeamComponentSet,
): TeamComponentEntry {
  return {
    id: publishedSet.id,
    key: publishedSet.key,
    name: publishedSet.name,
    file_key: publishedSet.file_key,
    project_id: publishedSet.project_id,
  };
}

async function writeDataFile(
  filePath: string,
  value: unknown,
  format: ContractFormat,
): Promise<void> {
  await writeFile(filePath, serializeContractData(value, format), "utf8");
}

function toLockVariants(
  components: ReturnType<typeof filterFileComponentsForComponentSet>,
): ContractLockVariant[] {
  return components.map((component) => ({
    key: component.key,
    node_id: component.node_id,
    name: component.name,
    updated_at: component.updated_at,
  }));
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
  const baseName = sanitizeFileName(
    resolveExportBaseName(
      options.componentSet,
      typeof raw.name === "string" ? raw.name : undefined,
    ),
  );
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
  const assetsContractPath = path.join(
    options.outputDir,
    contractArtifactFileName(baseName, "assets", format),
  );
  const structureDslPath = path.join(
    options.outputDir,
    `${baseName}.contract.structure.dsl`,
  );

  const lockVariants = toLockVariants(
    filterFileComponentsForComponentSet(fileComponents, componentSetNodeId),
  );
  const previousLock = await readContractLock(lockContractPath);
  const skipNodeIds = collectUnchangedVariantNodeIds(
    previousLock,
    lockVariants,
  );

  let assetsDir: string | undefined;
  let exportedAssets:
    | Awaited<ReturnType<typeof exportVariantAssets>>
    | undefined;

  if (options.exportAssets) {
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
  }

  const contractResult = await buildComponentSetPseudocodeFromRaw(raw, {
    variablesPath: options.variablesPath,
    assetBacked: options.exportAssets,
    assets: exportedAssets?.assets,
    format,
    metaContext: {
      component: teamComponentEntryFromPublishedSet(scope.publishedSet),
    },
  });
  await writeDataFile(visualsContractPath, contractResult.visuals, format);
  await writeDataFile(geometryContractPath, contractResult.geometry, format);
  await writeDataFile(metaContractPath, contractResult.meta, format);
  if (contractResult.assets) {
    await writeDataFile(assetsContractPath, contractResult.assets, format);
  }
  await writeFile(structureDslPath, contractResult.structureDsl, "utf8");

  const lock = buildContractLock({
    source: {
      file_key: scope.fileKey,
      node_id: componentSetNodeId,
      component_set_key: componentSetMeta.key,
      component_set_updated_at: componentSetMeta.updated_at,
    },
    variants: lockVariants,
    fingerprints: {
      tree: fingerprintTree(raw),
      contracts: fingerprintContracts(
        contractResult.visuals,
        contractResult.geometry,
        contractResult.structureDsl,
      ),
      ...(assetsDir
        ? {
            assets: await fingerprintAssetFiles(
              assetsDir,
              (await readdir(assetsDir))
                .filter((fileName) => fileName.endsWith(".svg"))
                .map((fileName) => fileName.slice(0, -".svg".length)),
            ),
          }
        : {}),
    },
  });
  await writeContractLock(lockContractPath, lock);

  return {
    visualsContractPath,
    geometryContractPath,
    metaContractPath,
    lockContractPath,
    structureDslPath,
    ...(contractResult.assets ? { assetsContractPath } : {}),
    assetsDir,
  };
}

export function writeExportResult(
  result: ExportComponentSetResult,
  stdout: NodeJS.WriteStream,
): void {
  const lines = [
    result.visualsContractPath,
    result.geometryContractPath,
    result.metaContractPath,
    result.lockContractPath,
    result.structureDslPath,
  ];
  if (result.assetsContractPath) {
    lines.push(result.assetsContractPath);
  }
  if (result.assetsDir) {
    lines.push(result.assetsDir);
  }
  stdout.write(`${lines.join("\n")}\n`);
}
