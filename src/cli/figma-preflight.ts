import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { FIGMA_API_BASE_URL } from "../figma-api/constants.js";
import { fetchFigmaResponse } from "../figma-api/fetch-with-retry.js";
import type { ConfiguredFigmaTeam } from "./figma-environment.js";

type FigmaPreflightStatus = "passed" | "failed" | "unavailable";

export interface FigmaPreflightResult {
  status: FigmaPreflightStatus;
  checkedAt: string;
  cliVersion: string;
  indexRoot: string;
  teams: Array<{
    alias: string;
    id: string;
    status: FigmaPreflightStatus;
    reason?: string;
  }>;
}

function responseStatus(response: Response): FigmaPreflightStatus {
  if (response.ok) {
    return "passed";
  }
  return [401, 403, 404].includes(response.status) ? "failed" : "unavailable";
}

function overallStatus(
  teams: FigmaPreflightResult["teams"],
): FigmaPreflightStatus {
  if (teams.some((team) => team.status === "failed")) {
    return "failed";
  }
  return teams.some((team) => team.status === "unavailable")
    ? "unavailable"
    : "passed";
}

async function checkTeam(options: {
  token: string;
  team: ConfiguredFigmaTeam;
  fetchImpl?: typeof fetch;
}): Promise<FigmaPreflightResult["teams"][number]> {
  try {
    const response = await fetchFigmaResponse(
      `${FIGMA_API_BASE_URL}/teams/${encodeURIComponent(options.team.id)}/projects`,
      options.token,
      options.fetchImpl,
    );
    const status = responseStatus(response);
    await response.arrayBuffer().catch(() => undefined);
    return {
      ...options.team,
      status,
      ...(status === "passed"
        ? {}
        : {
            reason: `Figma team access check returned HTTP ${response.status}.`,
          }),
    };
  } catch {
    return {
      ...options.team,
      status: "unavailable",
      reason: "Figma team access check could not reach the API.",
    };
  }
}

export async function runFigmaPreflight(options: {
  token: string;
  teams: readonly ConfiguredFigmaTeam[];
  indexRoot: string;
  cliVersion: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<FigmaPreflightResult> {
  await mkdir(options.indexRoot, { recursive: true });
  await access(options.indexRoot, constants.R_OK | constants.W_OK);
  const teams: FigmaPreflightResult["teams"] = [];
  for (const team of options.teams) {
    teams.push(
      await checkTeam({
        token: options.token,
        team,
        fetchImpl: options.fetchImpl,
      }),
    );
  }
  return {
    status: overallStatus(teams),
    checkedAt: (options.now ?? new Date()).toISOString(),
    cliVersion: options.cliVersion,
    indexRoot: options.indexRoot,
    teams,
  };
}
