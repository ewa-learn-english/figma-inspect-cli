import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listTeamProjectFiles } from "./list-team-project-files.js";
import { listTeamProjects } from "./list-team-projects.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("listTeamProjects", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requests top-level team folders and parses the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        folders: [
          {
            id: "proj-1",
            name: "Design System",
            parent_folder_id: null,
          },
        ],
      }),
    );

    await expect(
      listTeamProjects({
        token: "token",
        teamId: "team-123",
        fetchImpl,
      }),
    ).resolves.toEqual([{ id: "proj-1", name: "Design System" }]);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.figma.com/v2/teams/team-123/folders",
      { headers: { "X-FIGMA-TOKEN": "token" } },
    );
  });

  it("lists files from nested team folders", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/teams/team-123/folders")) {
        return jsonResponse({
          folders: [{ id: "root", name: "Root", parent_folder_id: null }],
        });
      }
      if (url.endsWith("/folders/root/folders")) {
        return jsonResponse({
          folders: [{ id: "nested", name: "Nested", parent_folder_id: "root" }],
        });
      }
      if (url.endsWith("/folders/nested/folders")) {
        return jsonResponse({ folders: [] });
      }
      if (url.endsWith("/folders/root/files")) {
        return jsonResponse({ files: [] });
      }
      if (url.endsWith("/folders/nested/files")) {
        return jsonResponse({
          files: [
            {
              key: "file-key",
              name: "Library",
              last_modified: "2026-09-03T00:00:00Z",
            },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(
      listTeamProjectFiles({
        token: "token",
        teamId: "team-123",
        fetchImpl,
      }),
    ).resolves.toEqual([
      {
        key: "file-key",
        name: "Library",
        last_modified: "2026-09-03T00:00:00Z",
        project_id: "nested",
        project_name: "Nested",
      },
    ]);
  });
});
