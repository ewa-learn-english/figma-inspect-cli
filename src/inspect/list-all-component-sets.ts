import {
  listTeamComponentSets,
  listTeamProjectFiles,
} from "../figma-api/index.js";
import type {
  FigmaTeamComponentSet,
  ListAllComponentSetsOptions,
} from "./types.js";

export async function listAllComponentSets({
  token,
  teamId,
  fetchImpl = fetch,
}: ListAllComponentSetsOptions): Promise<FigmaTeamComponentSet[]> {
  const [publishedSets, files] = await Promise.all([
    listTeamComponentSets({ token, teamId, fetchImpl }),
    listTeamProjectFiles({ token, teamId, fetchImpl }),
  ]);

  const filesByKey = new Map(files.map((file) => [file.key, file]));

  return publishedSets
    .map((componentSet) => {
      const file = filesByKey.get(componentSet.file_key);

      return {
        id: componentSet.node_id,
        key: componentSet.key,
        name: componentSet.name,
        fileKey: componentSet.file_key,
        fileName: file?.name ?? "",
        projectId: file?.project_id ?? "",
        projectName: file?.project_name ?? "",
      };
    })
    .sort((left, right) =>
      left.projectName !== right.projectName
        ? left.projectName.localeCompare(right.projectName)
        : left.fileName !== right.fileName
          ? left.fileName.localeCompare(right.fileName)
          : left.name.localeCompare(right.name),
    );
}
