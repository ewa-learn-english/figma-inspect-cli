import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("requests team projects and parses the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        projects: [{ id: "proj-1", name: "Design System" }],
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
      "https://api.figma.com/v1/teams/team-123/projects",
      { headers: { "X-FIGMA-TOKEN": "token" } },
    );
  });
});
