import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshManagedTeamIndexes } from "./managed-team-index.js";

let indexRoot: string | undefined;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    statusText: status === 200 ? "OK" : "Forbidden",
    headers: { "content-type": "application/json" },
  });
}

describe("refreshManagedTeamIndexes", () => {
  beforeEach(async () => {
    vi.stubEnv("FIGMA_CACHE", "0");
    indexRoot = await mkdtemp(path.join(os.tmpdir(), "figma-indexes-"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (indexRoot) {
      await rm(indexRoot, { recursive: true, force: true });
    }
  });

  it("refreshes the remaining teams when one team fails", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/teams/broken/folders")) {
        return jsonResponse({ status: 403, err: "Invalid scope" }, 403);
      }
      if (url.endsWith("/teams/healthy/folders")) {
        return jsonResponse({
          folders: [{ id: "project", name: "Project", parent_folder_id: null }],
        });
      }
      if (url.endsWith("/folders/project/folders")) {
        return jsonResponse({ folders: [] });
      }
      if (url.endsWith("/folders/project/files")) {
        return jsonResponse({
          files: [
            {
              key: "file",
              name: "File",
              last_modified: "2026-07-01T00:00:00Z",
            },
          ],
        });
      }
      if (url.endsWith("/files/file")) {
        return jsonResponse({
          document: { id: "0:0", type: "DOCUMENT", name: "Document" },
          componentSets: {},
          components: {},
        });
      }
      return new Response("not found", { status: 404 });
    });
    const log = vi.fn();

    const results = await refreshManagedTeamIndexes({
      token: "token",
      teams: [
        { alias: "broken", id: "broken" },
        { alias: "healthy", id: "healthy" },
      ],
      indexRoot: indexRoot ?? "",
      fetchImpl,
      log,
    });

    expect(results[0]).toEqual({
      team: { alias: "broken", id: "broken" },
      databasePath: path.join(indexRoot ?? "", "broken", "figma-index.sqlite3"),
      error: "Figma API request failed (403 Forbidden): Invalid scope",
    });
    expect(results[1]).toMatchObject({
      team: { alias: "healthy", id: "healthy" },
      fileCount: 1,
      failedFiles: [],
    });
    expect(log).toHaveBeenCalledWith(
      "broken: failed: Figma API request failed (403 Forbidden): Invalid scope",
    );
  });
});
