import type { ContractFormat } from "../inspect/contract/contract-format.js";
import type {
  ExportPreviewOptions,
  NestedAssetsOptions,
} from "../inspect/index.js";
import { resolveExportContractTarget } from "../inspect/index.js";
import type { FigmaNodeRef } from "../inspect/types.js";
import { CliError } from "./errors.js";
import {
  type ExportComponentSetResult,
  exportComponentSet,
} from "./export-component-set.js";
import {
  type ExportNodeContractResult,
  exportNodeContract,
} from "./export-node-contract.js";

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
  | ExportComponentSetResult
  | ExportNodeContractResult;

export async function exportContract(
  options: ExportContractOptions,
): Promise<ExportContractResult> {
  const target = await resolveExportContractTarget({
    token: options.token,
    fileKey: options.fileKey,
    nodeId: options.nodeId,
  });

  if (target.kind === "component-set") {
    if (!options.teamId) {
      throw new CliError(
        "Missing FIGMA_TEAM_ID environment variable or unambiguous FIGMA_TEAMS selection; pass --team when multiple teams are configured.",
      );
    }

    return exportComponentSet({
      token: options.token,
      teamId: options.teamId,
      outputDir: options.outputDir,
      componentSet: {
        kind: "node",
        fileKey: target.fileKey,
        nodeId: target.nodeId,
      },
      sourceUrl: options.sourceUrl,
      variablesPath: options.variablesPath,
      exportAssets: options.exportAssets,
      assetFormat: options.assetFormat,
      nestedAssets: options.nestedAssets,
      preview: options.preview,
      format: options.format,
    });
  }

  return exportNodeContract({
    token: options.token,
    outputDir: options.outputDir,
    fileKey: target.fileKey,
    nodeId: target.nodeId,
    sourceUrl: options.sourceUrl,
    variablesPath: options.variablesPath,
    nestedAssets: options.nestedAssets,
    preview: options.preview,
    format: options.format,
  });
}
