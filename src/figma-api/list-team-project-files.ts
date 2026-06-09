import { listProjectFiles } from "./list-project-files.js";
import { listTeamProjects } from "./list-team-projects.js";
import type { FigmaTeamProjectFile } from "./schemas.js";
import type { ListTeamProjectFilesOptions } from "./types.js";

export async function listTeamProjectFiles({
  token,
  teamId,
  fetchImpl = fetch,
}: ListTeamProjectFilesOptions): Promise<FigmaTeamProjectFile[]> {
  const projects = await listTeamProjects({ token, teamId, fetchImpl });

  const fileLists = await Promise.all(
    projects.map(async (project) => {
      const files = await listProjectFiles({
        token,
        projectId: project.id,
        fetchImpl,
      });

      return files.map((file) => ({
        ...file,
        project_id: project.id,
        project_name: project.name,
      }));
    }),
  );

  return fileLists.flat();
}
