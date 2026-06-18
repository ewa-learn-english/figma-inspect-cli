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
  importNotesPath?: string;
}

export type ExportArtifactPathResult = ExportArtifactPaths &
  ExportArtifactPathExtras;

export function writeExportArtifactPaths(
  result: ExportArtifactPathResult,
  stdout: NodeJS.WriteStream,
): void {
  const lines = [
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
    result.importNotesPath,
  ]) {
    if (optionalPath && !lines.includes(optionalPath)) {
      lines.push(optionalPath);
    }
  }

  stdout.write(`${lines.join("\n")}\n`);
}
