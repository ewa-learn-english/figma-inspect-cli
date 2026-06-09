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
