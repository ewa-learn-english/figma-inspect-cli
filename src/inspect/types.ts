import type { FigmaComponentSet, FileNodeEntry } from "./schemas.js";

export interface FigmaNodeRef {
  fileKey: string;
  nodeId: string;
}

export type FigmaTeamComponentSet = FigmaComponentSet & {
  fileKey: string;
  fileName: string;
  projectId: string;
  projectName: string;
};

export interface ListAllComponentSetsOptions {
  token: string;
  teamId: string;
  fetchImpl?: typeof fetch;
}

export interface FigmaComponentSetProperty {
  id: string;
  name: string;
  isExposedInstance: boolean;
}

export type ComponentSetLookup =
  | { kind: "key"; value: string }
  | { kind: "name"; value: string };

export type ComponentSetTarget =
  | ComponentSetLookup
  | ({ kind: "node" } & FigmaNodeRef);

export interface ExportContractTarget extends FigmaNodeRef {
  kind: "component-set" | "node" | "section";
  entry: FileNodeEntry;
  source: unknown;
}

export interface ComponentSetScopeOptions extends FigmaNodeRef {
  token: string;
  componentSet: ComponentSetLookup;
  fetchImpl?: typeof fetch;
}

export interface ComponentSetNodeRefOptions extends FigmaNodeRef {
  token: string;
  fetchImpl?: typeof fetch;
}
