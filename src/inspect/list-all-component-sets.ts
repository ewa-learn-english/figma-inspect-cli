import { listFilePages, listTeamProjectFiles } from "../figma-api/index.js";
import { listNodeComponentSets } from "./list-node-component-sets.js";
import type {
  FigmaTeamComponentSet,
  ListAllComponentSetsOptions,
} from "./types.js";

export async function listAllComponentSets({
  token,
  teamId,
  fetchImpl = fetch,
}: ListAllComponentSetsOptions): Promise<FigmaTeamComponentSet[]> {
  const files = await listTeamProjectFiles({ token, teamId, fetchImpl });
  const componentSets: FigmaTeamComponentSet[] = [];

  for (const file of files) {
    const pages = await listFilePages({
      token,
      fileKey: file.key,
      fetchImpl,
    });
    const seen = new Set<string>();

    for (const page of pages) {
      const sets = await listNodeComponentSets({
        token,
        fileKey: file.key,
        nodeId: page.id,
        fetchImpl,
      });

      for (const componentSet of sets) {
        if (seen.has(componentSet.id)) {
          continue;
        }

        seen.add(componentSet.id);
        componentSets.push({
          ...componentSet,
          file_key: file.key,
          file_name: file.name,
          project_id: file.project_id,
          project_name: file.project_name,
        });
      }
    }
  }

  return componentSets.sort((left, right) =>
    left.project_name !== right.project_name
      ? left.project_name.localeCompare(right.project_name)
      : left.file_name !== right.file_name
        ? left.file_name.localeCompare(right.file_name)
        : left.name.localeCompare(right.name),
  );
}
