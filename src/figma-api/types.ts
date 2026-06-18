export interface ListTeamProjectsOptions {
  token: string;
  teamId: string;
  fetchImpl?: typeof fetch;
}

export interface ListTeamProjectFilesOptions {
  token: string;
  teamId: string;
  fetchImpl?: typeof fetch;
}

export interface ListTeamComponentSetsOptions {
  token: string;
  teamId: string;
  fetchImpl?: typeof fetch;
}

export interface ListProjectFilesOptions {
  token: string;
  projectId: string;
  fetchImpl?: typeof fetch;
}

export interface ListFileComponentSetsOptions {
  token: string;
  fileKey: string;
  fetchImpl?: typeof fetch;
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

export interface GetFileOptions {
  token: string;
  fileKey: string;
  fetchImpl?: typeof fetch;
}

export interface GetFileImagesOptions {
  token: string;
  fileKey: string;
  nodeIds: string[];
  format: "svg" | "png";
  scale?: number;
  fetchImpl?: typeof fetch;
}

export interface GetComponentSetOptions {
  token: string;
  componentSetKey: string;
  fetchImpl?: typeof fetch;
}

export interface ListFileComponentsOptions {
  token: string;
  fileKey: string;
  fetchImpl?: typeof fetch;
}
