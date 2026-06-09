import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import { type FigmaProject, parseTeamProjectsResponse } from "./schemas.js";
import type { ListTeamProjectsOptions } from "./types.js";

export async function listTeamProjects({
  token,
  teamId,
  fetchImpl = fetch,
}: ListTeamProjectsOptions): Promise<FigmaProject[]> {
  const payload = await figmaRequest(
    `${FIGMA_API_BASE_URL}/teams/${encodeURIComponent(teamId)}/projects`,
    token,
    fetchImpl,
  );

  return parseTeamProjectsResponse(payload);
}
