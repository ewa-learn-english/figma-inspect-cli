export interface FigmaProject {
  id: string | number;
  name?: string;
  file_count?: number | null;
}

export interface ListTeamProjectsOptions {
  token: string;
  teamId: string;
  fetchImpl?: typeof fetch;
}
