import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportTeamIndex } from "./export-team-index.js";

const previousCache = process.env.FIGMA_CACHE;
let outputDir: string | undefined;

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("exportTeamIndex", () => {
  beforeEach(async () => {
    process.env.FIGMA_CACHE = "0";
    outputDir = await mkdtemp(path.join(os.tmpdir(), "figma-index-"));
  });

  afterEach(async () => {
    process.env.FIGMA_CACHE = previousCache;
    if (outputDir) {
      await rm(outputDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("writes a SQLite team index", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/teams/team/projects")) {
        return jsonResponse({
          projects: [{ id: "profile-project", name: "Profile" }],
        });
      }

      if (url.endsWith("/projects/profile-project/files")) {
        return jsonResponse({
          files: [
            {
              key: "file-key",
              name: "Settings",
              last_modified: "2026-06-17T12:43:44Z",
            },
          ],
        });
      }

      if (url.endsWith("/files/file-key")) {
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
                    name: "Settings / Phone",
                    absoluteBoundingBox: {
                      x: 0,
                      y: 0,
                      width: 390,
                      height: 844,
                    },
                  },
                ],
              },
            ],
          },
          componentSets: {},
          components: {},
        });
      }

      return new Response("not found", { status: 404 });
    });

    const result = await exportTeamIndex({
      token: "token",
      teamId: "team",
      outputDir: outputDir ?? "",
      fetchImpl,
    });

    expect(result).toMatchObject({
      fileCount: 1,
      componentSetCount: 0,
      componentCount: 0,
      screenCount: 1,
    });
    expect(path.basename(result.databasePath)).toBe("figma-index.sqlite3");

    const database = new DatabaseSync(result.databasePath, { readOnly: true });
    try {
      expect(
        database
          .prepare("SELECT value FROM metadata WHERE name = ?")
          .get("kind"),
      ).toEqual({ value: "figma-team-index" });
      expect(database.prepare("SELECT * FROM files").all()).toEqual([
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
      expect(database.prepare("SELECT * FROM screens").all()).toEqual([
        {
          file_key: "file-key",
          screen_id: "1:1",
          name: "Settings / Phone",
          size: "390x844",
          group_id: null,
          last_modified: "2026-06-17T12:43:44Z",
          url: "https://www.figma.com/design/file-key/Settings?node-id=1-1&m=dev",
        },
      ]);
    } finally {
      database.close();
    }
  });
});
