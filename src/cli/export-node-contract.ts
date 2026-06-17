import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type ContractFormat,
  serializeContractData,
} from "../inspect/contract/contract-format.js";
import {
  buildNodeContractFromRef,
  readNodeContractArtifacts,
  resolveNodeContractLockPath,
  resolveNodeGeometryContractPath,
  resolveNodeMetaContractPath,
  resolveNodeStructureDslPath,
  resolveNodeVisualsContractPath,
  validateNodeContractArtifacts,
  writeNodeContractLock,
} from "../inspect/index.js";
import type { FigmaNodeRef } from "../inspect/types.js";
import type {
  ExportArtifactPathExtras,
  ExportArtifactPaths,
} from "./export-result.js";

export interface ExportNodeContractOptions extends FigmaNodeRef {
  token: string;
  outputDir: string;
  sourceUrl?: string;
  variablesPath: string;
  format?: ContractFormat;
}

export interface ExportNodeContractResult
  extends ExportArtifactPaths,
    Pick<ExportArtifactPathExtras, "importNotesPath"> {}

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
  nodeType: string;
  nodeName: string;
  kind: string;
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
    `nodeType: ${JSON.stringify(options.nodeType)}`,
    `nodeName: ${JSON.stringify(options.nodeName)}`,
    `kind: ${JSON.stringify(options.kind)}`,
    "",
  ];
  await writeFile(notesPath, lines.join("\n"), "utf8");

  return notesPath;
}

export async function exportNodeContract(
  options: ExportNodeContractOptions,
): Promise<ExportNodeContractResult> {
  const format = options.format ?? "yaml";
  const contract = await buildNodeContractFromRef({
    token: options.token,
    fileKey: options.fileKey,
    nodeId: options.nodeId,
    sourceUrl: options.sourceUrl,
    variablesPath: options.variablesPath,
    format,
  });

  await mkdir(options.outputDir, { recursive: true });

  const visualsContractPath = resolveNodeVisualsContractPath(
    options.outputDir,
    contract.nodeName,
    contract.kind,
    format,
  );
  const geometryContractPath = resolveNodeGeometryContractPath(
    options.outputDir,
    contract.nodeName,
    contract.kind,
    format,
  );
  const metaContractPath = resolveNodeMetaContractPath(
    options.outputDir,
    contract.nodeName,
    contract.kind,
    format,
  );
  const lockContractPath = resolveNodeContractLockPath(
    options.outputDir,
    contract.nodeName,
    contract.kind,
  );
  const structureDslPath = resolveNodeStructureDslPath(
    options.outputDir,
    contract.nodeName,
    contract.kind,
  );

  await writeDataFile(visualsContractPath, contract.visuals, format);
  await writeDataFile(geometryContractPath, contract.geometry, format);
  await writeDataFile(metaContractPath, contract.meta, format);
  await writeFile(structureDslPath, contract.structureDsl, "utf8");

  const artifacts = await readNodeContractArtifacts(
    options.outputDir,
    contract.nodeName,
    contract.kind,
    format,
  );
  validateNodeContractArtifacts(artifacts, format);
  await writeNodeContractLock(lockContractPath, contract.lock);

  const importNotesPath = await writeImportNotes({
    outputDir: options.outputDir,
    sourceUrl: options.sourceUrl,
    fileKey: options.fileKey,
    nodeId: contract.source.nodeId,
    nodeType: contract.source.nodeType,
    nodeName: contract.source.name,
    kind: contract.kind,
  });

  return {
    visualsContractPath,
    geometryContractPath,
    metaContractPath,
    lockContractPath,
    structureDslPath,
    importNotesPath,
  };
}
