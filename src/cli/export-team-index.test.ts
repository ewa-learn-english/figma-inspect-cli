import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
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

  it("writes team and per-file YAML indexes", async () => {
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
    const teamIndexYaml = await readFile(result.teamIndexPath, "utf8");
    expect(teamIndexYaml).toContain("files:\n  - key: file-key\n");
    const teamIndex = parse(teamIndexYaml);
    expect(teamIndex).toEqual({
      version: 1,
      kind: "figma-team-index",
      team: "team",
      files: [
        {
          key: "file-key",
          name: "Settings",
          lastModified: "2026-06-17T12:43:44Z",
          projectId: "profile-project",
          projectName: "Profile",
          index: "Profile.Settings.file-key.index.yaml",
          componentSets: 0,
          components: 0,
          screens: 1,
        },
      ],
    });

    const fileIndexYaml = await readFile(
      result.fileIndexPaths[0] ?? "",
      "utf8",
    );
    expect(fileIndexYaml).toContain("file:\n  key: file-key\n");
    expect(fileIndexYaml).toContain("screens:\n  - id: 1:1\n");
    const fileIndex = parse(fileIndexYaml);
    expect(fileIndex).toEqual({
      version: 1,
      kind: "figma-file-index",
      file: {
        key: "file-key",
        name: "Settings",
        lastModified: "2026-06-17T12:43:44Z",
        projectId: "profile-project",
        projectName: "Profile",
      },
      componentSets: [],
      components: [],
      screens: [
        {
          id: "1:1",
          name: "Settings / Phone",
          size: "390x844",
          group: null,
          lastModified: "2026-06-17T12:43:44Z",
          url: "https://www.figma.com/design/file-key/Settings?node-id=1-1&m=dev",
        },
      ],
      screenGroups: [],
      componentUsages: [],
    });
  });
});
