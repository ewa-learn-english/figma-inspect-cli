export interface FigmaProject {
  id: string | number;
  name?: string;
  file_count?: number | null;
}

export interface FigmaFile {
  key: string;
  name?: string;
  thumbnail_url?: string;
  last_modified?: string;
}

export interface ListTeamProjectsOptions {
  token: string;
  teamId: string;
  fetchImpl?: typeof fetch;
}

export interface ListProjectFilesOptions {
  token: string;
  projectId: string;
  fetchImpl?: typeof fetch;
}

export interface FigmaPage {
  id: string;
  name: string;
}

export interface ListFilePagesOptions {
  token: string;
  fileKey: string;
  fetchImpl?: typeof fetch;
}

export interface GetFileNodeOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  fetchImpl?: typeof fetch;
}

export interface FigmaComponentSet {
  id: string;
  key: string;
  name: string;
}

export interface ListNodeComponentSetsOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  fetchImpl?: typeof fetch;
}

export interface GetNodeComponentSetOptions {
  token: string;
  fileKey: string;
  nodeId: string;
  componentSetKey?: string;
  componentSetName?: string;
  fetchImpl?: typeof fetch;
}

export interface FigmaComponentSetProperty {
  id: string;
  name: string;
  isExposedInstance: boolean;
}
