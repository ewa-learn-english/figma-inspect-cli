import { FIGMA_API_BASE_URL } from "./constants.js";
import { FigmaApiError } from "./figma-api-error.js";
import { formatFigmaError } from "./format-figma-error.js";
import type { FigmaFile, ListProjectFilesOptions } from "./types.js";

interface ProjectFilesResponse {
  files?: FigmaFile[];
}

export async function listProjectFiles({
  token,
  projectId,
  fetchImpl = fetch,
}: ListProjectFilesOptions): Promise<FigmaFile[]> {
  const response = await fetchImpl(
    `${FIGMA_API_BASE_URL}/projects/${encodeURIComponent(projectId)}/files`,
    {
      headers: {
        "X-FIGMA-TOKEN": token,
      },
    },
  );

  if (!response.ok) {
    throw new FigmaApiError(await formatFigmaError(response));
  }

  const payload = (await response.json()) as ProjectFilesResponse;
  return Array.isArray(payload.files) ? payload.files : [];
}
