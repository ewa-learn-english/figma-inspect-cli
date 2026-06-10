import type { ContractFormat } from "../inspect/contract-format.js";
import type { ComponentSetLookup } from "../inspect/types.js";

export interface CliIo {
  env: NodeJS.ProcessEnv;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
}

export interface ComponentSetCommandScope {
  fileKey: string;
  nodeId: string;
  componentSet: ComponentSetLookup;
}

export type CliCommand =
  | { kind: "help" }
  | { kind: "list-team-projects"; format: ContractFormat }
  | { kind: "list-project-files"; projectId: string; format: ContractFormat }
  | { kind: "list-team-project-files"; format: ContractFormat }
  | { kind: "list-team-component-sets"; format: ContractFormat }
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
  | {
      kind: "inspect-file-node";
      fileKey: string;
      nodeId: string;
      format: ContractFormat;
    }
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
      kind: "export-component-set";
      outputDir: string;
      componentSet: ComponentSetLookup;
      variablesPath: string;
      exportAssets?: boolean;
      assetFormat?: "svg";
      format: ContractFormat;
    };
