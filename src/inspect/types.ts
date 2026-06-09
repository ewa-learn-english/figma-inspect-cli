import type { FigmaComponentSet } from "./schemas.js";

export type FigmaTeamComponentSet = FigmaComponentSet & {
  file_key: string;
  file_name: string;
  project_id: string;
  project_name: string;
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

export interface ComponentSetScopeOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  componentSet: ComponentSetLookup;
  fetchImpl?: typeof fetch;
}
