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
  | { kind: "list-team-projects"; json: boolean }
  | { kind: "list-project-files"; projectId: string; json: boolean }
  | { kind: "list-team-project-files"; json: boolean }
  | { kind: "list-team-component-sets"; json: boolean }
  | { kind: "list-file-pages"; fileKey: string; json: boolean }
  | { kind: "list-file-component-sets"; fileKey: string; json: boolean }
  | {
      kind: "inspect-component-set-properties";
      scope: ComponentSetCommandScope;
      json: boolean;
    }
  | { kind: "inspect-component-set"; scope: ComponentSetCommandScope }
  | {
      kind: "inspect-team-component-set";
      componentSet: ComponentSetLookup;
    }
  | { kind: "inspect-file-node"; fileKey: string; nodeId: string }
  | {
      kind: "build-component-set-spec";
      inputPath: string;
      variablesPath?: string;
      teamComponentsPath?: string;
    }
  | {
      kind: "build-component-set-pseudocode";
      inputPath: string;
      outputDir?: string;
      variablesPath?: string;
      teamComponentsPath?: string;
    }
  | {
      kind: "export-component-set";
      outputDir: string;
      componentSet: ComponentSetLookup;
      variablesPath?: string;
      exportAssets?: boolean;
      assetFormat?: "svg";
    };
