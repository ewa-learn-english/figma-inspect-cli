import path from "node:path";
import { listTeamProjectFiles } from "../figma-api/list-team-project-files.js";
import type { FigmaTeamProjectFile } from "../figma-api/schemas.js";
import {
  buildTeamIndexFile,
  fetchTeamIndexEntry,
  teamIndexBuild,
  teamIndexSettings,
} from "../inspect/index.js";
import {
  completeTeamIndexRefresh,
  countTeamIndex,
  type FailedIndexFile,
  type IndexedFileVersion,
  openTeamIndexForRefresh,
  readIndexedFileVersions,
  readTeamIndexBuild,
  removeIndexedFiles,
  replaceIndexedFile,
  startTeamIndexBuild,
  TEAM_INDEX_DATABASE_FILE,
  type TeamIndexCounts,
} from "../inspect/team-index-database.js";

export interface ExportTeamIndexOptions {
  token: string;
  teamId: string;
  outputDir: string;
  screenSimilarityThreshold?: number;
  screenSizeTolerance?: number;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}

export type ExportTeamIndexResult = TeamIndexCounts &
  Readonly<{
    databasePath: string;
    updatedFileCount: number;
    failedFiles: FailedIndexFile[];
  }>;

function isIndexed(
  indexed: IndexedFileVersion | undefined,
  file: FigmaTeamProjectFile,
): boolean {
  return (
    indexed?.lastModified === file.last_modified &&
    indexed.name === file.name &&
    indexed.projectId === file.project_id &&
    indexed.projectName === file.project_name
  );
}

/**
 * Refreshes a team index in place: unchanged files are kept, changed files are
 * downloaded one at a time, and a failed file keeps its previous rows.
 */
export async function exportTeamIndex({
  token,
  teamId,
  outputDir,
  screenSimilarityThreshold,
  screenSizeTolerance,
  fetchImpl,
  log,
}: ExportTeamIndexOptions): Promise<ExportTeamIndexResult> {
  const settings = teamIndexSettings({
    screenSimilarityThreshold,
    screenSizeTolerance,
  });
  const files = await listTeamProjectFiles({ token, teamId, fetchImpl });
  const databasePath = path.join(outputDir, TEAM_INDEX_DATABASE_FILE);
  const database = await openTeamIndexForRefresh({ databasePath, teamId });
  try {
    const build = teamIndexBuild(settings);
    if (readTeamIndexBuild(database) !== build) {
      startTeamIndexBuild(database, build);
    }
    const indexed = readIndexedFileVersions(database);
    const listedKeys = new Set(files.map((file) => file.key));
    removeIndexedFiles(
      database,
      [...indexed.keys()].filter((key) => !listedKeys.has(key)),
    );

    const changed = files.filter(
      (file) => !isIndexed(indexed.get(file.key), file),
    );
    log?.(
      `${files.length} files, ${changed.length} changed since the last refresh.`,
    );

    const failedFiles: FailedIndexFile[] = [];
    for (const [position, file] of changed.entries()) {
      const label = `[${position + 1}/${changed.length}] ${file.project_name} / ${file.name} (${file.key})`;
      try {
        const entry = await fetchTeamIndexEntry({
          token,
          fileKey: file.key,
          fetchImpl,
        });
        replaceIndexedFile(
          database,
          buildTeamIndexFile({ metadata: file, entry }, settings),
        );
        log?.(`${label} indexed`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedFiles.push({
          key: file.key,
          name: file.name,
          projectName: file.project_name,
          error: message,
        });
        log?.(`${label} failed: ${message}`);
      }
    }

    completeTeamIndexRefresh(database, {
      generatedAt: new Date().toISOString(),
      failedFiles,
    });
    return {
      databasePath,
      ...countTeamIndex(database),
      updatedFileCount: changed.length - failedFiles.length,
      failedFiles,
    };
  } finally {
    database.close();
  }
}
