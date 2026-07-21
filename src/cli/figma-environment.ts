import os from "node:os";
import path from "node:path";
import { TEAM_INDEX_DATABASE_FILE } from "../inspect/team-index-database.js";
import { CliError } from "./errors.js";

export interface ConfiguredFigmaTeam {
  alias: string;
  id: string;
}

const LEGACY_TEAM_ALIAS = "default";

function parseTeamMap(raw: string): ConfiguredFigmaTeam[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError(
      "FIGMA_TEAMS must be a JSON object of team aliases to team ids.",
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CliError(
      "FIGMA_TEAMS must be a JSON object of team aliases to team ids.",
    );
  }

  const teams = Object.entries(parsed).map(([rawAlias, rawId]) => {
    const alias = rawAlias.trim();
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!alias || !id) {
      throw new CliError(
        "FIGMA_TEAMS aliases and team ids must be non-empty strings.",
      );
    }
    if (alias !== rawAlias || id !== rawId) {
      throw new CliError(
        "FIGMA_TEAMS aliases and team ids must not have surrounding whitespace.",
      );
    }
    return { alias, id };
  });

  const ids = new Set(teams.map((team) => team.id));
  if (ids.size !== teams.length) {
    throw new CliError(
      "FIGMA_TEAMS must not assign the same team id to multiple aliases.",
    );
  }

  return [...teams].sort((left, right) =>
    left.alias.localeCompare(right.alias),
  );
}

export function configuredFigmaTeams(
  env: NodeJS.ProcessEnv,
): ConfiguredFigmaTeam[] {
  const rawTeams = env.FIGMA_TEAMS;
  if (rawTeams !== undefined) {
    return parseTeamMap(rawTeams);
  }

  const legacyTeamId = env.FIGMA_TEAM_ID?.trim();
  return legacyTeamId ? [{ alias: LEGACY_TEAM_ALIAS, id: legacyTeamId }] : [];
}

export function selectConfiguredFigmaTeams(
  env: NodeJS.ProcessEnv,
  teamAlias?: string,
): ConfiguredFigmaTeam[] {
  const teams = configuredFigmaTeams(env);
  if (teams.length === 0) {
    throw new CliError(
      "Missing FIGMA_TEAM_ID or FIGMA_TEAMS environment variable.",
    );
  }
  if (teamAlias === undefined) {
    return teams;
  }

  const selected = teams.find((team) => team.alias === teamAlias);
  if (selected === undefined) {
    throw new CliError(
      `Unknown Figma team alias ${JSON.stringify(teamAlias)}.`,
    );
  }
  return [selected];
}

export function selectSingleFigmaTeam(
  env: NodeJS.ProcessEnv,
  teamAlias?: string,
): ConfiguredFigmaTeam {
  if (teamAlias === undefined && env.FIGMA_TEAM_ID?.trim()) {
    return { alias: LEGACY_TEAM_ALIAS, id: env.FIGMA_TEAM_ID.trim() };
  }

  const teams = selectConfiguredFigmaTeams(env, teamAlias);
  if (teams.length !== 1) {
    throw new CliError(
      "Multiple Figma teams are configured. Pass --team <alias> for this command.",
    );
  }
  return teams[0];
}

export function optionalSingleFigmaTeamId(
  env: NodeJS.ProcessEnv,
  teamAlias?: string,
): string | undefined {
  if (teamAlias !== undefined || env.FIGMA_TEAM_ID?.trim()) {
    return selectSingleFigmaTeam(env, teamAlias).id;
  }
  const teams = configuredFigmaTeams(env);
  return teams.length === 1 ? teams[0]?.id : undefined;
}

export function resolveFigmaIndexRoot(
  env: NodeJS.ProcessEnv,
  indexRoot?: string,
): string {
  const configured = indexRoot ?? env.FIGMA_INDEX_ROOT;
  return path.resolve(
    configured ?? path.join(os.homedir(), ".figma-inspect-cli", "indexes"),
  );
}

export function resolveTeamIndexDatabasePath(
  indexRoot: string,
  teamId: string,
): string {
  return path.join(
    indexRoot,
    encodeURIComponent(teamId),
    TEAM_INDEX_DATABASE_FILE,
  );
}
