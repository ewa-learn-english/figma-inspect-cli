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
        file_key: componentSet.file_key,
        file_name: file?.name ?? "",
        project_id: file?.project_id ?? "",
        project_name: file?.project_name ?? "",
      };
    })
    .sort((left, right) =>
      left.project_name !== right.project_name
        ? left.project_name.localeCompare(right.project_name)
        : left.file_name !== right.file_name
          ? left.file_name.localeCompare(right.file_name)
          : left.name.localeCompare(right.name),
    );
}
