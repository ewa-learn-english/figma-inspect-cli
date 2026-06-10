import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildComponentSetPseudocodeFromRaw,
  loadComponentSetContext,
  resolveTeamComponentSetScope,
} from "../inspect/index.js";
import type { ComponentSetLookup } from "../inspect/types.js";

export interface ExportComponentSetOptions {
  token: string;
  teamId: string;
  outputDir: string;
  componentSet: ComponentSetLookup;
  variablesPath?: string;
  teamComponentsPath?: string;
}

export interface ExportComponentSetResult {
  rawPath: string;
  visualsContractPath: string;
  geometryContractPath: string;
  metaContractPath: string;
  structureDslPath: string;
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

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

  const rawPath = path.join(options.outputDir, `${baseName}.json`);
  const visualsContractPath = path.join(
    options.outputDir,
    `${baseName}.contract.visuals.json`,
  );
  const geometryContractPath = path.join(
    options.outputDir,
    `${baseName}.contract.geometry.json`,
  );
  const metaContractPath = path.join(
    options.outputDir,
    `${baseName}.contract.meta.json`,
  );
  const structureDslPath = path.join(
    options.outputDir,
    `${baseName}.contract.structure.dsl`,
  );

  await writeJsonFile(rawPath, raw);

  const contractResult = await buildComponentSetPseudocodeFromRaw(raw, {
    variablesPath: options.variablesPath,
    teamComponentsPath: options.teamComponentsPath,
  });
  await writeJsonFile(visualsContractPath, contractResult.visuals);
  await writeJsonFile(geometryContractPath, contractResult.geometry);
  await writeJsonFile(metaContractPath, contractResult.meta);
  await writeFile(structureDslPath, contractResult.structureDsl, "utf8");

  return {
    rawPath,
    visualsContractPath,
    geometryContractPath,
    metaContractPath,
    structureDslPath,
  };
}

export function writeExportResult(
  result: ExportComponentSetResult,
  stdout: NodeJS.WriteStream,
): void {
  stdout.write(
    `${result.rawPath}\n${result.visualsContractPath}\n${result.geometryContractPath}\n${result.metaContractPath}\n${result.structureDslPath}\n`,
  );
}
