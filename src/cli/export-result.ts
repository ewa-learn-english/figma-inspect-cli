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
  if (result.previewPath) {
    lines.push(result.previewPath);
  }
  if (result.assetsDir) {
    lines.push(result.assetsDir);
  }
  if (result.importNotesPath) {
    lines.push(result.importNotesPath);
  }
  stdout.write(`${lines.join("\n")}\n`);
}
