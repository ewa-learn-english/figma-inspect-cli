import path from "node:path";
import { listTeamProjectFiles } from "../figma-api/list-team-project-files.js";
import { fetchFileEntry } from "../inspect/fetch-file-entry.js";
import {
  type BuildTeamIndexFileInput,
  buildTeamIndex,
} from "../inspect/index.js";
import {
  TEAM_INDEX_DATABASE_FILE,
  writeTeamIndexDatabase,
} from "../inspect/team-index-database.js";

export interface ExportTeamIndexOptions {
  token: string;
  teamId: string;
  outputDir: string;
  screenSimilarityThreshold?: number;
  screenSizeTolerance?: number;
  fetchImpl?: typeof fetch;
}

export interface ExportTeamIndexResult {
  databasePath: string;
  fileCount: number;
  componentSetCount: number;
  componentCount: number;
  screenCount: number;
}

export async function exportTeamIndex({
  token,
  teamId,
  outputDir,
  screenSimilarityThreshold,
  screenSizeTolerance,
  fetchImpl,
}: ExportTeamIndexOptions): Promise<ExportTeamIndexResult> {
  const files = await listTeamProjectFiles({ token, teamId, fetchImpl });
  const inputs: BuildTeamIndexFileInput[] = [];
  for (const metadata of files) {
    inputs.push({
      metadata,
      entry: await fetchFileEntry({
        token,
        fileKey: metadata.key,
        fetchImpl,
      }),
    });
  }

  const index = buildTeamIndex({
    teamId,
    files: inputs,
    screenSimilarityThreshold,
    screenSizeTolerance,
  });

  const databasePath = path.join(outputDir, TEAM_INDEX_DATABASE_FILE);
  await writeTeamIndexDatabase({ databasePath, index });

  const componentSetCount = index.files.reduce(
    (total, file) => total + file.componentSets.length,
    0,
  );
  const componentCount = index.files.reduce(
    (total, file) => total + file.components.length,
    0,
  );
  const screenCount = index.files.reduce(
    (total, file) => total + file.screens.length,
    0,
  );

  return {
    databasePath,
    fileCount: index.files.length,
    componentSetCount,
    componentCount,
    screenCount,
  };
}
