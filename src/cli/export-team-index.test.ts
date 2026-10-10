import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportTeamIndex } from "./export-team-index.js";

let outputDir: string | undefined;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    statusText: status === 200 ? "OK" : "Internal Server Error",
    headers: { "content-type": "application/json" },
  });
}

interface ListedFile {
  key: string;
  name: string;
  last_modified: string;
}

function fileResponse(screenName: string): Response {
  return jsonResponse({
    document: {
      id: "0:0",
      type: "DOCUMENT",
      name: "Document",
      children: [
        {
          id: "0:1",
          type: "CANVAS",
          name: "Screens",
          children: [
            {
              id: "1:1",
              type: "FRAME",
              name: screenName,
              absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 844 },
            },
          ],
        },
      ],
    },
    componentSets: {},
    components: {},
  });
}

function figmaTeam(files: () => ListedFile[], failingKeys = new Set<string>()) {
  const fileRequests: string[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/teams/team/folders")) {
      return jsonResponse({
        folders: [
          { id: "profile-project", name: "Profile", parent_folder_id: null },
        ],
      });
    }
    if (url.endsWith("/folders/profile-project/folders")) {
      return jsonResponse({ folders: [] });
    }
    if (url.endsWith("/folders/profile-project/files")) {
      return jsonResponse({ files: files() });
    }

    const fileKey = url.match(/\/files\/([^/?]+)$/)?.[1];
    if (fileKey) {
      fileRequests.push(fileKey);
      return failingKeys.has(fileKey)
        ? jsonResponse({ status: 500, err: "Upstream failure" }, 500)
        : fileResponse(`${fileKey} / Phone`);
    }

    return new Response("not found", { status: 404 });
  });
  return { fetchImpl, fileRequests };
}

function readRows(databasePath: string, sql: string): unknown[] {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare(sql).all();
  } finally {
    database.close();
  }
}

describe("exportTeamIndex", () => {
  beforeEach(async () => {
    vi.stubEnv("FIGMA_CACHE", "0");
    outputDir = await mkdtemp(path.join(os.tmpdir(), "figma-index-"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (outputDir) {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("writes a SQLite team index", async () => {
    const { fetchImpl } = figmaTeam(() => [
      {
        key: "file-key",
        name: "Settings",
        last_modified: "2026-06-17T12:43:44Z",
      },
    ]);

    const result = await exportTeamIndex({
      token: "token",
      teamId: "team",
      outputDir: outputDir ?? "",
      fetchImpl,
    });

    expect(result).toMatchObject({
      fileCount: 1,
      updatedFileCount: 1,
      failedFiles: [],
      componentSetCount: 0,
      componentCount: 0,
      screenCount: 1,
    });
    expect(path.basename(result.databasePath)).toBe("figma-index.sqlite3");
    expect(
      readRows(result.databasePath, "SELECT name, value FROM metadata"),
    ).toEqual(
      expect.arrayContaining([
        { name: "kind", value: "figma-team-index" },
        { name: "team", value: "team" },
        { name: "failed_files", value: "[]" },
      ]),
    );
    expect(readRows(result.databasePath, "SELECT * FROM files")).toEqual([
      {
        file_key: "file-key",
        name: "Settings",
        last_modified: "2026-06-17T12:43:44Z",
        project_id: "profile-project",
        project_name: "Profile",
        component_set_count: 0,
        component_count: 0,
        screen_count: 1,
      },
    ]);
    expect(readRows(result.databasePath, "SELECT * FROM screens")).toEqual([
      {
        file_key: "file-key",
        screen_id: "1:1",
        name: "file-key / Phone",
        size: "390x844",
        group_id: null,
        last_modified: "2026-06-17T12:43:44Z",
        url: "https://www.figma.com/design/file-key/Settings?node-id=1-1&m=dev",
      },
    ]);
  });

  it("downloads only changed files and drops files removed from the team", async () => {
    let listed: ListedFile[] = [
      { key: "kept", name: "Kept", last_modified: "2026-07-01T00:00:00Z" },
      { key: "edited", name: "Edited", last_modified: "2026-07-01T00:00:00Z" },
      {
        key: "removed",
        name: "Removed",
        last_modified: "2026-07-01T00:00:00Z",
      },
    ];
    const { fetchImpl, fileRequests } = figmaTeam(() => listed);
    const options = {
      token: "token",
      teamId: "team",
      outputDir: outputDir ?? "",
      fetchImpl,
    };
    await exportTeamIndex(options);

    listed = [
      listed[0],
      { key: "edited", name: "Edited", last_modified: "2026-07-02T00:00:00Z" },
    ];
    fileRequests.length = 0;
    const log = vi.fn();
    const result = await exportTeamIndex({ ...options, log });

    expect(fileRequests).toEqual(["edited"]);
    expect(result).toMatchObject({ fileCount: 2, updatedFileCount: 1 });
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      "2 files, 1 changed since the last refresh.",
      "[1/1] Profile / Edited (edited) indexed",
    ]);
    expect(
      readRows(
        result.databasePath,
        "SELECT file_key, last_modified FROM files ORDER BY file_key",
      ),
    ).toEqual([
      { file_key: "edited", last_modified: "2026-07-02T00:00:00Z" },
      { file_key: "kept", last_modified: "2026-07-01T00:00:00Z" },
    ]);
  });

  it("indexes every other file and keeps the previous version of a failed file", async () => {
    let lastModified = "2026-07-01T00:00:00Z";
    const failingKeys = new Set<string>();
    const { fetchImpl } = figmaTeam(
      () => [
        { key: "healthy", name: "Healthy", last_modified: lastModified },
        { key: "broken", name: "Broken", last_modified: lastModified },
      ],
      failingKeys,
    );
    const options = {
      token: "token",
      teamId: "team",
      outputDir: outputDir ?? "",
      fetchImpl,
    };
    await exportTeamIndex(options);

    lastModified = "2026-07-02T00:00:00Z";
    failingKeys.add("broken");
    const result = await exportTeamIndex(options);

    expect(result.failedFiles).toEqual([
      {
        key: "broken",
        name: "Broken",
        projectName: "Profile",
        error:
          "Figma API request failed (500 Internal Server Error): Upstream failure",
      },
    ]);
    expect(result).toMatchObject({ fileCount: 2, updatedFileCount: 1 });
    expect(
      readRows(
        result.databasePath,
        "SELECT file_key, last_modified FROM files ORDER BY file_key",
      ),
    ).toEqual([
      { file_key: "broken", last_modified: "2026-07-01T00:00:00Z" },
      { file_key: "healthy", last_modified: "2026-07-02T00:00:00Z" },
    ]);
  });

  it("downloads files again when their name or the index settings change", async () => {
    let listed: ListedFile[] = [
      { key: "a", name: "Alpha", last_modified: "2026-07-01T00:00:00Z" },
      { key: "b", name: "Beta", last_modified: "2026-07-01T00:00:00Z" },
    ];
    const { fetchImpl, fileRequests } = figmaTeam(() => listed);
    const options = {
      token: "token",
      teamId: "team",
      outputDir: outputDir ?? "",
      fetchImpl,
    };
    await exportTeamIndex(options);

    listed = [listed[0], { ...listed[1], name: "Beta renamed" }];
    fileRequests.length = 0;
    await exportTeamIndex(options);
    expect(fileRequests).toEqual(["b"]);

    fileRequests.length = 0;
    await exportTeamIndex({ ...options, screenSimilarityThreshold: 0.5 });
    expect(fileRequests).toEqual(["a", "b"]);

    fileRequests.length = 0;
    await exportTeamIndex({ ...options, screenSimilarityThreshold: 0.5 });
    expect(fileRequests).toEqual([]);
  });

  it("keeps a failed file readable during a rebuild and retries it next time", async () => {
    const failingKeys = new Set<string>();
    const { fetchImpl, fileRequests } = figmaTeam(
      () => [
        {
          key: "healthy",
          name: "Healthy",
          last_modified: "2026-07-01T00:00:00Z",
        },
        {
          key: "broken",
          name: "Broken",
          last_modified: "2026-07-01T00:00:00Z",
        },
      ],
      failingKeys,
    );
    const options = {
      token: "token",
      teamId: "team",
      outputDir: outputDir ?? "",
      fetchImpl,
      screenSizeTolerance: 4,
    };
    await exportTeamIndex({ ...options, screenSizeTolerance: 2 });

    failingKeys.add("broken");
    const rebuilt = await exportTeamIndex(options);
    expect(rebuilt.failedFiles.map((file) => file.key)).toEqual(["broken"]);
    expect(
      readRows(
        rebuilt.databasePath,
        "SELECT file_key, screen_id FROM screens ORDER BY file_key",
      ),
    ).toEqual([
      { file_key: "broken", screen_id: "1:1" },
      { file_key: "healthy", screen_id: "1:1" },
    ]);

    failingKeys.clear();
    fileRequests.length = 0;
    await exportTeamIndex(options);
    expect(fileRequests).toEqual(["broken"]);
  });

  it("continues an interrupted first build with the files it has not indexed", async () => {
    const listed = [
      { key: "a", name: "Alpha", last_modified: "2026-07-01T00:00:00Z" },
      { key: "b", name: "Beta", last_modified: "2026-07-01T00:00:00Z" },
    ];
    const { fetchImpl, fileRequests } = figmaTeam(() => listed);
    const options = {
      token: "token",
      teamId: "team",
      outputDir: outputDir ?? "",
      fetchImpl,
    };
    const databasePath = path.join(outputDir ?? "", "figma-index.sqlite3");
    const metadataAfterFirstFile: unknown[] = [];
    await exportTeamIndex({
      ...options,
      log: (message) => {
        if (message.startsWith("[1/2]")) {
          metadataAfterFirstFile.push(
            ...readRows(
              databasePath,
              "SELECT name FROM metadata ORDER BY name",
            ),
          );
        }
      },
    });
    // The build is recorded before downloads start, and completion only later.
    expect(metadataAfterFirstFile).toEqual([
      { name: "index_build" },
      { name: "kind" },
      { name: "schema_version" },
      { name: "team" },
      { name: "version" },
    ]);

    // Recreate the state of a process stopped right after "a" was indexed.
    const database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON");
    database.prepare("DELETE FROM files WHERE file_key = ?").run("b");
    database
      .prepare("DELETE FROM metadata WHERE name IN (?, ?)")
      .run("generated_at", "failed_files");
    database.close();

    fileRequests.length = 0;
    await exportTeamIndex(options);
    expect(fileRequests).toEqual(["b"]);
  });
});
