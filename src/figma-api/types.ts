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
