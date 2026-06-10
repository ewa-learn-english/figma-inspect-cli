import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listTeamComponentSets } from "./list-team-component-sets.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("listTeamComponentSets", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("follows cursor pagination until all pages are loaded", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          meta: {
            component_sets: [
              {
                key: "set-1",
                file_key: "file-1",
                node_id: "1:1",
                name: "Button",
              },
            ],
            cursor: { after: "cursor-2" },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          meta: {
            component_sets: [
              {
                key: "set-2",
                file_key: "file-2",
                node_id: "2:2",
                name: "Input",
              },
            ],
          },
        }),
      );

    await expect(
      listTeamComponentSets({
        token: "token",
        teamId: "team-123",
        fetchImpl,
      }),
    ).resolves.toEqual([
      {
        key: "set-1",
        file_key: "file-1",
        node_id: "1:1",
        name: "Button",
      },
      {
        key: "set-2",
        file_key: "file-2",
        node_id: "2:2",
        name: "Input",
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "https://api.figma.com/v1/teams/team-123/component_sets",
    );
    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe(
      "https://api.figma.com/v1/teams/team-123/component_sets?after=cursor-2",
    );
  });
});
