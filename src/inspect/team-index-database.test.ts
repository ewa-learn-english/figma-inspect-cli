import { mkdtemp, rm, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { TeamIndexBundle } from "./team-index.js";
import {
  readTeamIndexStatus,
  searchTeamIndexComponents,
  writeTeamIndexDatabase,
} from "./team-index-database.js";

let temporaryDirectory: string | undefined;

function indexBundle(): TeamIndexBundle {
  return {
    team: {
      version: 1,
      kind: "figma-team-index",
      team: "team-1",
      generatedAt: "2026-07-20T00:00:00.000Z",
      files: [
        {
          key: "file-1",
          name: "Library",
          lastModified: "2026-07-19T00:00:00.000Z",
          projectId: "project-1",
          projectName: "Design System",
          componentSets: 1,
          components: 1,
          screens: 0,
        },
      ],
    },
    files: [
      {
        version: 1,
        kind: "figma-file-index",
        file: {
          key: "file-1",
          name: "Library",
          lastModified: "2026-07-19T00:00:00.000Z",
          projectId: "project-1",
          projectName: "Design System",
        },
        componentSets: [
          {
            id: "1:1",
            key: "button-set",
            name: "Primary Button",
            lastModified: "2026-07-19T00:00:00.000Z",
            url: "https://www.figma.com/design/file-1/Library?node-id=1-1",
          },
        ],
        components: [
          {
            id: "2:1",
            key: "icon-key",
            name: "Button Icon",
            lastModified: "2026-07-19T00:00:00.000Z",
            url: "https://www.figma.com/design/file-1/Library?node-id=2-1",
          },
        ],
        screens: [],
        screenGroups: [],
        componentUsages: [],
      },
    ],
  };
}

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

describe("managed team index database", () => {
  it("reports freshness and searches component names case-insensitively", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "figma-db-"));
    const databasePath = path.join(temporaryDirectory, "figma-index.sqlite3");
    await writeTeamIndexDatabase({ databasePath, index: indexBundle() });

    await expect(
      readTeamIndexStatus({
        databasePath,
        teamAlias: "design",
        teamId: "team-1",
        now: new Date("2026-07-21T00:00:01.000Z"),
      }),
    ).resolves.toMatchObject({
      exists: true,
      generatedAt: "2026-07-20T00:00:00.000Z",
      ageSeconds: 86_401,
      fileCount: 1,
      componentSetCount: 1,
      componentCount: 1,
    });

    const results = await searchTeamIndexComponents({
      databasePath,
      teamAlias: "design",
      teamId: "team-1",
      query: "BUTTON",
    });
    expect(results.map(({ type, name }) => ({ type, name }))).toEqual([
      { type: "component", name: "Button Icon" },
      { type: "component-set", name: "Primary Button" },
    ]);
  });

  it("uses file modification time for indexes written before generated_at", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "figma-db-"));
    const databasePath = path.join(temporaryDirectory, "figma-index.sqlite3");
    await writeTeamIndexDatabase({ databasePath, index: indexBundle() });
    const database = new DatabaseSync(databasePath);
    database.prepare("DELETE FROM metadata WHERE name = ?").run("generated_at");
    database.close();
    const modifiedAt = new Date("2026-07-20T12:00:00.000Z");
    await utimes(databasePath, modifiedAt, modifiedAt);

    const status = await readTeamIndexStatus({
      databasePath,
      teamAlias: "design",
      teamId: "team-1",
      now: new Date("2026-07-21T00:00:00.000Z"),
    });

    expect(status.generatedAt).toBe(modifiedAt.toISOString());
    expect(status.ageSeconds).toBe(43_200);
  });
});
