import type { ContractFormat } from "../inspect/contract/contract-format.js";
import type {
  ExportPreviewOptions,
  NestedAssetsOptions,
} from "../inspect/index.js";
import type {
  ComponentSetLookup,
  ComponentSetTarget,
  FigmaNodeRef,
} from "../inspect/types.js";

export interface CliIo {
  env: NodeJS.ProcessEnv;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
}

export type ComponentSetCommandScope =
  | ({ kind: "lookup"; componentSet: ComponentSetLookup } & FigmaNodeRef)
  | ({ kind: "node" } & FigmaNodeRef);

export type CliCommand =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "list-team-projects"; format: ContractFormat }
  | { kind: "list-project-files"; projectId: string; format: ContractFormat }
  | { kind: "list-team-project-files"; format: ContractFormat }
  | {
      kind: "export-team-index";
      outputDir: string;
      screenSimilarityThreshold?: number;
      screenSizeTolerance?: number;
    }
  | { kind: "list-team-component-sets"; format: ContractFormat }
  | {
      kind: "list-component-set-usages";
      indexDir: string;
      componentSet: ComponentSetLookup;
      screenGroup?: string;
      full?: boolean;
      format: ContractFormat;
    }
  | {
      kind: "inspect-component-set-responsive-usage";
      indexDir: string;
      componentSet: ComponentSetLookup;
      screenGroup?: string;
      full?: boolean;
      format: ContractFormat;
    }
  | { kind: "list-file-pages"; fileKey: string; format: ContractFormat }
  | {
      kind: "list-file-component-sets";
      fileKey: string;
      format: ContractFormat;
    }
  | {
      kind: "inspect-component-set-properties";
      scope: ComponentSetCommandScope;
      format: ContractFormat;
    }
  | {
      kind: "inspect-component-set";
      scope: ComponentSetCommandScope;
      format: ContractFormat;
    }
  | {
      kind: "inspect-team-component-set";
      componentSet: ComponentSetLookup;
      format: ContractFormat;
    }
  | ({
      kind: "inspect-file-node";
      sourceUrl?: string;
      format: ContractFormat;
    } & FigmaNodeRef)
  | {
      kind: "build-component-set-spec";
      inputPath: string;
      variablesPath: string;
      teamComponentsPath?: string;
      format: ContractFormat;
    }
  | {
      kind: "build-component-set-pseudocode";
      inputPath: string;
      outputDir?: string;
      variablesPath: string;
      teamComponentsPath?: string;
      format: ContractFormat;
    }
  | {
      kind: "verify-component-contract";
      contractDir: string;
      componentName?: string;
      contractFormat?: ContractFormat;
      outputFormat: ContractFormat;
    }
  | {
      kind: "verify-component-lock";
      lockFile: string;
      outputFormat: ContractFormat;
    }
  | {
      kind: "verify-node-contract";
      contractDir: string;
      nodeName?: string;
      contractFormat?: ContractFormat;
      outputFormat: ContractFormat;
    }
  | {
      kind: "export-component-set";
      outputDir: string;
      componentSet: ComponentSetTarget;
      sourceUrl?: string;
      variablesPath: string;
      exportAssets?: boolean;
      assetFormat?: "svg";
      nestedAssets?: NestedAssetsOptions;
      preview?: ExportPreviewOptions;
      format: ContractFormat;
    }
  | ({
      kind: "export-contract";
      outputDir: string;
      sourceUrl?: string;
      variablesPath: string;
      exportAssets?: boolean;
      assetFormat?: "svg";
      nestedAssets?: NestedAssetsOptions;
      preview?: ExportPreviewOptions;
      format: ContractFormat;
    } & FigmaNodeRef)
  | ({
      kind: "export-node-contract";
      outputDir: string;
      sourceUrl?: string;
      variablesPath: string;
      nestedAssets?: NestedAssetsOptions;
      preview?: ExportPreviewOptions;
      format: ContractFormat;
    } & FigmaNodeRef);
