import { FIGMA_API_BASE_URL } from "./constants.js";
import { FigmaApiError } from "./figma-api-error.js";
import { formatFigmaError } from "./format-figma-error.js";
import type { FigmaProject, ListTeamProjectsOptions } from "./types.js";

interface TeamProjectsResponse {
  projects?: FigmaProject[];
}

export async function listTeamProjects({
  token,
  teamId,
  fetchImpl = fetch,
}: ListTeamProjectsOptions): Promise<FigmaProject[]> {
  const response = await fetchImpl(
    `${FIGMA_API_BASE_URL}/teams/${encodeURIComponent(teamId)}/projects`,
    {
      headers: {
        "X-FIGMA-TOKEN": token,
      },
    },
  );

  if (!response.ok) {
    throw new FigmaApiError(await formatFigmaError(response));
  }

  const payload = (await response.json()) as TeamProjectsResponse;
  return Array.isArray(payload.projects) ? payload.projects : [];
}
