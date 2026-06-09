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
  | { kind: "list-projects"; json: boolean }
  | { kind: "list-project-files"; projectId: string; json: boolean }
  | { kind: "list-pages"; fileKey: string; json: boolean }
  | {
      kind: "list-component-sets";
      fileKey: string;
      nodeId: string;
      json: boolean;
    }
  | {
      kind: "list-component-set-properties";
      scope: ComponentSetCommandScope;
      json: boolean;
    }
  | { kind: "inspect-component-set"; scope: ComponentSetCommandScope }
  | { kind: "inspect-node"; fileKey: string; nodeId: string };
