import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TeamComponentEntry } from "../inspect/component-set-spec/team-component-registry.js";
import {
  type ContractFormat,
  contractArtifactFileName,
  serializeContractData,
} from "../inspect/contract-format.js";
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
  rawPath: string;
  visualsContractPath: string;
  geometryContractPath: string;
  metaContractPath: string;
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

export async function exportComponentSet(
  options: ExportComponentSetOptions,
): Promise<ExportComponentSetResult> {
  const scope = await resolveTeamComponentSetScope({
    token: options.token,
    teamId: options.teamId,
    componentSet: options.componentSet,
  });
  const context = await loadComponentSetContext({
    token: options.token,
    ...scope,
  });
  const raw = context.tree;
  const baseName = sanitizeFileName(
    resolveExportBaseName(
      options.componentSet,
      typeof raw.name === "string" ? raw.name : undefined,
    ),
  );

  await mkdir(options.outputDir, { recursive: true });

  const format = options.format ?? "yaml";
  const rawPath = path.join(
    options.outputDir,
    contractArtifactFileName(baseName, "raw", format),
  );
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
  const assetsContractPath = path.join(
    options.outputDir,
    contractArtifactFileName(baseName, "assets", format),
  );
  const structureDslPath = path.join(
    options.outputDir,
    `${baseName}.contract.structure.dsl`,
  );

  await writeDataFile(rawPath, raw, format);

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

  return {
    rawPath,
    visualsContractPath,
    geometryContractPath,
    metaContractPath,
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
    result.rawPath,
    result.visualsContractPath,
    result.geometryContractPath,
    result.metaContractPath,
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
