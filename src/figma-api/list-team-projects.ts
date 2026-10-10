import { FIGMA_API_V2_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import { type FigmaProject, parseTeamProjectsResponse } from "./schemas.js";
import type {
  ListProjectFilesOptions,
  ListTeamProjectsOptions,
} from "./types.js";

// Folder listings carry no version to revalidate a cached copy, and index
// refreshes rely on their current file modification times.
async function listFolders(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<FigmaProject[]> {
  return parseTeamProjectsResponse(
    await figmaRequest(url, token, fetchImpl, { cache: false }),
  );
}

export async function listTeamProjects({
  token,
  teamId,
  fetchImpl = fetch,
}: ListTeamProjectsOptions): Promise<FigmaProject[]> {
  return listFolders(
    `${FIGMA_API_V2_BASE_URL}/teams/${encodeURIComponent(teamId)}/folders`,
    token,
    fetchImpl,
  );
}

export async function listProjectFolders({
  token,
  projectId,
  fetchImpl = fetch,
}: ListProjectFilesOptions): Promise<FigmaProject[]> {
  return listFolders(
    `${FIGMA_API_V2_BASE_URL}/folders/${encodeURIComponent(projectId)}/folders`,
    token,
    fetchImpl,
  );
}
