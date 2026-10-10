import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeTeamIndexFixture } from "../test/team-index.js";
import type { TeamIndexFile } from "./team-index.js";
import {
  countTeamIndex,
  openTeamIndexForRefresh,
  readIndexedFileVersions,
  readTeamIndexStatus,
  removeIndexedFiles,
  replaceIndexedFile,
  searchTeamIndexComponents,
} from "./team-index-database.js";

let temporaryDirectory: string | undefined;

function libraryFile(fileKey = "file-1", name = "Library"): TeamIndexFile {
  const lastModified = "2026-07-19T00:00:00.000Z";
  return {
    version: 1,
    kind: "figma-file-index",
    file: {
      key: fileKey,
      name,
      lastModified,
      projectId: "project-1",
      projectName: "Design System",
    },
    componentSets: [
      {
        id: "1:1",
        key: `${fileKey}-button-set`,
        name: "Primary Button",
        lastModified,
        url: `https://www.figma.com/design/${fileKey}/${name}?node-id=1-1`,
      },
    ],
    components: [
      {
        id: "2:1",
        key: `${fileKey}-icon`,
        name: "Button Icon",
        lastModified,
        url: `https://www.figma.com/design/${fileKey}/${name}?node-id=2-1`,
      },
    ],
    screens: [],
    screenGroups: [],
    componentUsages: [],
  };
}

async function databasePath(): Promise<string> {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "figma-db-"));
  return path.join(temporaryDirectory, "figma-index.sqlite3");
}

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

describe("managed team index database", () => {
  it("reports freshness and searches component names case-insensitively", async () => {
    const indexPath = await databasePath();
    await writeTeamIndexFixture({
      databasePath: indexPath,
      teamId: "team-1",
      files: [libraryFile()],
    });

    await expect(
      readTeamIndexStatus({
        databasePath: indexPath,
        teamAlias: "design",
        teamId: "team-1",
        now: new Date("2026-07-21T00:00:01.000Z"),
      }),
    ).resolves.toEqual({
      team: { alias: "design", id: "team-1" },
      databasePath: indexPath,
      exists: true,
      generatedAt: "2026-07-20T00:00:00.000Z",
      ageSeconds: 86_401,
      fileCount: 1,
      componentSetCount: 1,
      componentCount: 1,
    });

    const results = await searchTeamIndexComponents({
      databasePath: indexPath,
      teamAlias: "design",
      teamId: "team-1",
      query: "BUTTON",
    });
    expect(results.map(({ type, name }) => ({ type, name }))).toEqual([
      { type: "component", name: "Button Icon" },
      { type: "component-set", name: "Primary Button" },
    ]);
  });

  it("keeps indexed files while a refresh runs and reports failed files", async () => {
    const indexPath = await databasePath();
    const database = await openTeamIndexForRefresh({
      databasePath: indexPath,
      teamId: "team-1",
    });
    try {
      replaceIndexedFile(database, libraryFile());
    } finally {
      database.close();
    }

    const unfinished = await readTeamIndexStatus({
      databasePath: indexPath,
      teamAlias: "design",
      teamId: "team-1",
    });
    expect(unfinished).toMatchObject({ exists: true, fileCount: 1 });
    expect(unfinished).not.toHaveProperty("generatedAt");
    expect(unfinished).not.toHaveProperty("ageSeconds");

    const failedFile = {
      key: "file-2",
      name: "Screens",
      projectName: "Design System",
      error: "Figma API request failed (500 Internal Server Error)",
    };
    await writeTeamIndexFixture({
      databasePath: indexPath,
      teamId: "team-1",
      files: [],
      failedFiles: [failedFile],
    });
    await expect(
      readTeamIndexStatus({
        databasePath: indexPath,
        teamAlias: "design",
        teamId: "team-1",
      }),
    ).resolves.toMatchObject({ fileCount: 1, failedFiles: [failedFile] });
  });

  it("replaces and removes files without touching other indexed files", async () => {
    const indexPath = await databasePath();
    await writeTeamIndexFixture({
      databasePath: indexPath,
      teamId: "team-1",
      files: [libraryFile("file-1"), libraryFile("file-2", "Icons")],
    });

    const database = await openTeamIndexForRefresh({
      databasePath: indexPath,
      teamId: "team-1",
    });
    try {
      const renamed = libraryFile("file-1", "Library v2");
      replaceIndexedFile(database, renamed);
      expect(readIndexedFileVersions(database).get("file-1")).toEqual({
        name: "Library v2",
        lastModified: "2026-07-19T00:00:00.000Z",
        projectId: "project-1",
        projectName: "Design System",
      });
      expect(countTeamIndex(database)).toEqual({
        fileCount: 2,
        componentSetCount: 2,
        componentCount: 2,
        screenCount: 0,
      });

      removeIndexedFiles(database, ["file-2"]);
      expect([...readIndexedFileVersions(database).keys()]).toEqual(["file-1"]);
      expect(countTeamIndex(database)).toEqual({
        fileCount: 1,
        componentSetCount: 1,
        componentCount: 1,
        screenCount: 0,
      });
    } finally {
      database.close();
    }
  });

  it("rebuilds a database that belongs to another team", async () => {
    const indexPath = await databasePath();
    await writeTeamIndexFixture({
      databasePath: indexPath,
      teamId: "team-1",
      files: [libraryFile()],
    });

    const database = await openTeamIndexForRefresh({
      databasePath: indexPath,
      teamId: "team-2",
    });
    try {
      expect(countTeamIndex(database).fileCount).toBe(0);
    } finally {
      database.close();
    }
  });

  it("reports a file that is not a database instead of replacing it", async () => {
    const indexPath = await databasePath();
    const contents = "not a database ".repeat(20);
    await writeFile(indexPath, contents);

    await expect(
      openTeamIndexForRefresh({ databasePath: indexPath, teamId: "team-1" }),
    ).rejects.toThrow("file is not a database");
    expect(await readFile(indexPath, "utf8")).toBe(contents);
  });
});
