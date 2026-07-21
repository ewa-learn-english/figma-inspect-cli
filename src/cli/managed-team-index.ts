import path from "node:path";
import {
  readTeamIndexStatus,
  searchTeamIndexComponents,
  type TeamIndexComponentSearchResult,
  type TeamIndexStatus,
} from "../inspect/team-index-database.js";
import {
  type ExportTeamIndexResult,
  exportTeamIndex,
} from "./export-team-index.js";
import {
  type ConfiguredFigmaTeam,
  resolveTeamIndexDatabasePath,
} from "./figma-environment.js";

export type ManagedIndexRefreshResult = ExportTeamIndexResult &
  Readonly<{
    team: ConfiguredFigmaTeam;
  }>;

export async function refreshManagedTeamIndexes(options: {
  token: string;
  teams: readonly ConfiguredFigmaTeam[];
  indexRoot: string;
  screenSimilarityThreshold?: number;
  screenSizeTolerance?: number;
  fetchImpl?: typeof fetch;
}): Promise<ManagedIndexRefreshResult[]> {
  const results: ManagedIndexRefreshResult[] = [];
  for (const team of options.teams) {
    const databasePath = resolveTeamIndexDatabasePath(
      options.indexRoot,
      team.id,
    );
    const result = await exportTeamIndex({
      token: options.token,
      teamId: team.id,
      outputDir: path.dirname(databasePath),
      screenSimilarityThreshold: options.screenSimilarityThreshold,
      screenSizeTolerance: options.screenSizeTolerance,
      fetchImpl: options.fetchImpl,
    });
    results.push({ team, ...result });
  }
  return results;
}

export async function managedTeamIndexStatuses(options: {
  teams: readonly ConfiguredFigmaTeam[];
  indexRoot: string;
  now?: Date;
}): Promise<TeamIndexStatus[]> {
  return Promise.all(
    options.teams.map((team) =>
      readTeamIndexStatus({
        databasePath: resolveTeamIndexDatabasePath(options.indexRoot, team.id),
        teamAlias: team.alias,
        teamId: team.id,
        now: options.now,
      }),
    ),
  );
}

export async function searchManagedTeamIndexes(options: {
  teams: readonly ConfiguredFigmaTeam[];
  indexRoot: string;
  query: string;
}): Promise<TeamIndexComponentSearchResult[]> {
  const results = await Promise.all(
    options.teams.map((team) =>
      searchTeamIndexComponents({
        databasePath: resolveTeamIndexDatabasePath(options.indexRoot, team.id),
        teamAlias: team.alias,
        teamId: team.id,
        query: options.query,
      }),
    ),
  );
  return results
    .flat()
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.team.alias.localeCompare(right.team.alias) ||
        left.type.localeCompare(right.type) ||
        left.file.name.localeCompare(right.file.name) ||
        left.nodeId.localeCompare(right.nodeId),
    );
}
