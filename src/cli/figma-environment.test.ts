import path from "node:path";
import { describe, expect, it } from "vitest";
import { CliError } from "./errors.js";
import {
  configuredFigmaTeams,
  resolveFigmaIndexRoot,
  resolveTeamIndexDatabasePath,
  selectConfiguredFigmaTeams,
  selectSingleFigmaTeam,
} from "./figma-environment.js";

describe("Figma environment", () => {
  it("keeps FIGMA_TEAM_ID as the single-team fallback", () => {
    const env = { FIGMA_TEAM_ID: "legacy-team" };

    expect(configuredFigmaTeams(env)).toEqual([
      { alias: "default", id: "legacy-team" },
    ]);
    expect(selectSingleFigmaTeam(env)).toEqual({
      alias: "default",
      id: "legacy-team",
    });
  });

  it("selects one or all teams from FIGMA_TEAMS", () => {
    const env = {
      FIGMA_TEAMS: JSON.stringify({ product: "2", design: "1" }),
    };

    expect(selectConfiguredFigmaTeams(env)).toEqual([
      { alias: "design", id: "1" },
      { alias: "product", id: "2" },
    ]);
    expect(selectConfiguredFigmaTeams(env, "product")).toEqual([
      { alias: "product", id: "2" },
    ]);
    expect(() => selectSingleFigmaTeam(env)).toThrow(/Pass --team/);
  });

  it("rejects invalid maps without exposing their contents", () => {
    expect(() => configuredFigmaTeams({ FIGMA_TEAMS: "not-json" })).toThrow(
      CliError,
    );
    expect(() =>
      configuredFigmaTeams({
        FIGMA_TEAMS: JSON.stringify({ product: "1", design: "1" }),
      }),
    ).toThrow(/same team id/);
  });

  it("resolves stable per-team database paths", () => {
    const root = resolveFigmaIndexRoot(
      { FIGMA_INDEX_ROOT: "tmp/figma" },
      undefined,
    );

    expect(root).toBe(path.resolve("tmp/figma"));
    expect(resolveTeamIndexDatabasePath(root, "team/1")).toBe(
      path.join(root, "team%2F1", "figma-index.sqlite3"),
    );
  });
});
