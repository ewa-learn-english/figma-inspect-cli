export interface ExportArtifactPaths {
  visualsContractPath: string;
  geometryContractPath: string;
  metaContractPath: string;
  lockContractPath: string;
  structureDslPath: string;
}

export interface ExportArtifactPathExtras {
  previewPath?: string;
  assetsDir?: string;
  nestedAssetsDir?: string;
  nestedAssetsManifestPath?: string;
  layoutRisksPath?: string;
  importNotesPath?: string;
  assetExportWarning?: string;
  layoutRiskWarning?: string;
}

export type ExportArtifactPathResult = ExportArtifactPaths &
  ExportArtifactPathExtras;

export interface ExportSectionResult extends ExportArtifactPathExtras {
  indexPath: string;
  sourcePath: string;
  children: (ExportArtifactPathResult | ExportSectionResult)[];
}

export function writeExportArtifactPaths(
  result: ExportArtifactPathResult | ExportSectionResult,
  stdout: NodeJS.WriteStream,
): void {
  const lines =
    "indexPath" in result
      ? [result.indexPath, result.sourcePath]
      : [
          result.visualsContractPath,
          result.geometryContractPath,
          result.metaContractPath,
          result.lockContractPath,
          result.structureDslPath,
        ];
  for (const optionalPath of [
    result.previewPath,
    result.assetsDir,
    result.nestedAssetsDir,
    result.nestedAssetsManifestPath,
    result.layoutRisksPath,
    result.importNotesPath,
  ]) {
    if (optionalPath && !lines.includes(optionalPath)) {
      lines.push(optionalPath);
    }
  }

  stdout.write(`${lines.join("\n")}\n`);
  if ("children" in result) {
    for (const child of result.children)
      writeExportArtifactPaths(child, stdout);
  }
}

export function writeExportWarnings(
  result: ExportArtifactPathResult | ExportSectionResult,
  stderr: NodeJS.WriteStream,
): void {
  if ("children" in result) {
    for (const child of result.children) writeExportWarnings(child, stderr);
  }
  if (result.assetExportWarning) {
    stderr.write(`warning: ${result.assetExportWarning}\n`);
  }
  if (result.layoutRiskWarning) {
    stderr.write(`warning: ${result.layoutRiskWarning}\n`);
  }
}
