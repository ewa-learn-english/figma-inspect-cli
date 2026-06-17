import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaInspectError } from "./errors.js";
import { resolveTeamComponentSetScope } from "./resolve-team-component-set.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveTeamComponentSetScope", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves a published component set from a Figma node ref", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/nodes")) {
        return jsonResponse({
          nodes: {
            "1:2": {
              document: {
                id: "1:2",
                type: "COMPONENT_SET",
                isExposedInstance: false,
              },
              componentSets: {
                "1:2": { key: "set-key", name: "Cell" },
              },
              components: {},
            },
          },
        });
      }

      if (url.includes("/component_sets")) {
        return jsonResponse({
          meta: {
            component_sets: [
              {
                key: "set-key",
                file_key: "file-key",
                node_id: "1:2",
                name: "Cell",
              },
            ],
          },
        });
      }

      if (url.includes("/teams/team-id/projects")) {
        return jsonResponse({
          projects: [{ id: "project-id", name: "Design System" }],
        });
      }

      if (url.includes("/projects/project-id/files")) {
        return jsonResponse({
          files: [
            {
              key: "file-key",
              name: "Settings",
              last_modified: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    await expect(
      resolveTeamComponentSetScope({
        token: "token",
        teamId: "team-id",
        componentSet: {
          kind: "node",
          fileKey: "file-key",
          nodeId: "1:2",
        },
        fetchImpl,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        fileKey: "file-key",
        nodeId: "1:2",
        componentSet: { kind: "key", value: "set-key" },
        publishedSet: expect.objectContaining({ name: "Cell" }),
      }),
    );
  });

  it("rejects non-component-set node refs before registry lookup", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        nodes: {
          "1:2": {
            document: {
              id: "1:2",
              type: "FRAME",
              isExposedInstance: false,
            },
            componentSets: {},
            components: {},
          },
        },
      }),
    ) as typeof fetch;

    await expect(
      resolveTeamComponentSetScope({
        token: "token",
        teamId: "team-id",
        componentSet: {
          kind: "node",
          fileKey: "file-key",
          nodeId: "1:2",
        },
        fetchImpl,
      }),
    ).rejects.toThrow(
      new FigmaInspectError("Figma node 1:2 is FRAME; expected COMPONENT_SET."),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
