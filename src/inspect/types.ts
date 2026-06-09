export interface FigmaComponentSetProperty {
  id: string;
  name: string;
  isExposedInstance: boolean;
}

export type ComponentSetLookup =
  | { kind: "key"; value: string }
  | { kind: "name"; value: string };

export interface ListNodeComponentSetsOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  fetchImpl?: typeof fetch;
}

export interface ComponentSetScopeOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  componentSet: ComponentSetLookup;
  fetchImpl?: typeof fetch;
}
