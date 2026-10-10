import {
  type TeamIndexFile,
  teamIndexBuild,
  teamIndexSettings,
} from "../inspect/team-index.js";
import {
  completeTeamIndexRefresh,
  type FailedIndexFile,
  openTeamIndexForRefresh,
  replaceIndexedFile,
  startTeamIndexBuild,
} from "../inspect/team-index-database.js";

export async function writeTeamIndexFixture({
  databasePath,
  teamId,
  files,
  generatedAt = "2026-07-20T00:00:00.000Z",
  failedFiles = [],
}: {
  databasePath: string;
  teamId: string;
  files: readonly TeamIndexFile[];
  generatedAt?: string;
  failedFiles?: readonly FailedIndexFile[];
}): Promise<void> {
  const database = await openTeamIndexForRefresh({ databasePath, teamId });
  try {
    startTeamIndexBuild(database, teamIndexBuild(teamIndexSettings({})));
    for (const file of files) {
      replaceIndexedFile(database, file);
    }
    completeTeamIndexRefresh(database, { generatedAt, failedFiles });
  } finally {
    database.close();
  }
}
