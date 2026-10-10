import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaResponseTooLargeError } from "../figma-api/figma-api-error.js";
import { buildTeamIndexFile, teamIndexSettings } from "./team-index.js";
import { fetchTeamIndexEntry } from "./team-index-source.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 400 ? "Bad Request" : "OK",
    headers: { "content-type": "application/json" },
  });
}

const tooLarge = () =>
  jsonResponse(
    {
      status: 400,
      err: "Request too large. If applicable, filter by query params.",
    },
    400,
  );

function node(id: string, children?: unknown[]) {
  return {
    id,
    name: `Node ${id}`,
    type: "FRAME",
    fills: [{ type: "SOLID" }],
    ...(children ? { children } : {}),
  };
}

function nodesResponse(
  entries: Record<string, { document: unknown; components?: unknown }>,
) {
  return jsonResponse({
    nodes: Object.fromEntries(
      Object.entries(entries).map(([id, entry]) => [
        id,
        {
          document: entry.document,
          components: entry.components ?? {},
          componentSets: {},
        },
      ]),
    ),
  });
}

function figmaServer(routes: Record<string, () => Response>) {
  const requests: string[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const route = `${url.pathname.replace("/v1/files/file", "")}${decodeURIComponent(url.search)}`;
    requests.push(route);
    return routes[route]?.() ?? new Response("not found", { status: 404 });
  });
  return { fetchImpl, requests };
}

describe("fetchTeamIndexEntry", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("downloads small files whole and keeps only indexed fields", async () => {
    const { fetchImpl, requests } = figmaServer({
      "": () =>
        jsonResponse({
          document: node("0:0", [node("0:1", [node("1:1")])]),
          components: { "9:1": { key: "button", name: "Button" } },
          componentSets: {},
        }),
    });

    const entry = await fetchTeamIndexEntry({
      token: "token",
      fileKey: "file",
      fetchImpl,
    });

    expect(requests).toEqual([""]);
    expect(entry.document?.children?.[0]?.children?.[0]).toEqual({
      id: "1:1",
      name: "Node 1:1",
      type: "FRAME",
      isExposedInstance: false,
    });
    expect(entry.components).toEqual({
      "9:1": { key: "button", name: "Button" },
    });
  });

  it("splits oversized files into pages and oversized pages into children", async () => {
    const { fetchImpl, requests } = figmaServer({
      "": tooLarge,
      "?depth=1": () =>
        jsonResponse({
          document: node("0:0", [node("0:1"), node("0:2")]),
          components: {},
          componentSets: {},
        }),
      "/nodes?ids=0:1": () =>
        nodesResponse({
          "0:1": {
            document: node("0:1", [node("1:1")]),
            components: { "9:1": { key: "button", name: "Button" } },
          },
        }),
      "/nodes?ids=0:2": tooLarge,
      "/nodes?ids=0:2&depth=1": () =>
        nodesResponse({
          "0:2": { document: node("0:2", [node("2:1"), node("2:2")]) },
        }),
      "/nodes?ids=2:1": () =>
        nodesResponse({
          "2:1": {
            document: node("2:1", [node("2:3")]),
            components: { "9:2": { key: "icon", name: "Icon" } },
          },
        }),
      "/nodes?ids=2:2": () =>
        nodesResponse({ "2:2": { document: node("2:2") } }),
    });

    const entry = await fetchTeamIndexEntry({
      token: "token",
      fileKey: "file",
      fetchImpl,
    });

    expect(requests).toEqual([
      "",
      "?depth=1",
      "/nodes?ids=0:1",
      "/nodes?ids=0:2",
      "/nodes?ids=0:2&depth=1",
      "/nodes?ids=2:1",
      "/nodes?ids=2:2",
    ]);
    const ids = (value: { id?: string; children?: unknown[] } | undefined) =>
      value?.children?.map((child) => (child as { id: string }).id);
    expect(ids(entry.document)).toEqual(["0:1", "0:2"]);
    expect(ids(entry.document?.children?.[1])).toEqual(["2:1", "2:2"]);
    expect(ids(entry.document?.children?.[1]?.children?.[0])).toEqual(["2:3"]);
    expect(entry.components).toEqual({
      "9:1": { key: "button", name: "Button" },
      "9:2": { key: "icon", name: "Icon" },
    });
  });

  it("halves oversized batches of siblings", async () => {
    const { fetchImpl, requests } = figmaServer({
      "": tooLarge,
      "?depth=1": () =>
        jsonResponse({
          document: node("0:0", [node("0:1")]),
          components: {},
          componentSets: {},
        }),
      "/nodes?ids=0:1": tooLarge,
      "/nodes?ids=0:1&depth=1": () =>
        nodesResponse({
          "0:1": {
            document: node("0:1", [
              node("1:1"),
              node("1:2"),
              node("1:3"),
              node("1:4"),
            ]),
          },
        }),
      "/nodes?ids=1:1,1:2": tooLarge,
      "/nodes?ids=1:1": () =>
        nodesResponse({ "1:1": { document: node("1:1") } }),
      "/nodes?ids=1:2": () =>
        nodesResponse({ "1:2": { document: node("1:2") } }),
      "/nodes?ids=1:3,1:4": () =>
        nodesResponse({
          "1:3": { document: node("1:3") },
          "1:4": { document: node("1:4") },
        }),
    });

    const entry = await fetchTeamIndexEntry({
      token: "token",
      fileKey: "file",
      fetchImpl,
    });

    expect(requests.slice(4)).toEqual([
      "/nodes?ids=1:1,1:2",
      "/nodes?ids=1:1",
      "/nodes?ids=1:2",
      "/nodes?ids=1:3,1:4",
    ]);
    expect(
      entry.document?.children?.[0]?.children?.map((child) => child.id),
    ).toEqual(["1:1", "1:2", "1:3", "1:4"]);
  });

  it("indexes a split file exactly like the whole file", async () => {
    const screen = {
      id: "2:1",
      name: "Library / Phone",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "2:2",
          name: "Levels",
          type: "INSTANCE",
          componentId: "1:2",
          componentProperties: { Level: { type: "VARIANT", value: "B1" } },
        },
      ],
    };
    const componentSet = {
      id: "1:1",
      name: "Levels",
      type: "COMPONENT_SET",
      children: [{ id: "1:2", name: "Level=B1", type: "COMPONENT" }],
    };
    const componentSets = { "1:1": { key: "levels", name: "Levels" } };
    const components = {
      "1:2": { key: "level-b1", name: "Level=B1", componentSetId: "1:1" },
    };
    const page = (id: string, child: unknown) => ({
      id,
      name: `Page ${id}`,
      type: "CANVAS",
      children: [child],
    });
    const document = {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [page("0:1", componentSet), page("0:2", screen)],
    };
    const whole = figmaServer({
      "": () => jsonResponse({ document, componentSets, components }),
    });
    const split = figmaServer({
      "": tooLarge,
      "?depth=1": () =>
        jsonResponse({
          document: { ...document, children: [node("0:1"), node("0:2")] },
          componentSets: {},
          components: {},
        }),
      "/nodes?ids=0:1": () =>
        jsonResponse({
          nodes: {
            "0:1": {
              document: page("0:1", componentSet),
              componentSets,
              components,
            },
          },
        }),
      "/nodes?ids=0:2": () =>
        jsonResponse({
          nodes: {
            "0:2": { document: page("0:2", screen), componentSets, components },
          },
        }),
    });
    const metadata = {
      key: "file",
      name: "Grammar cards",
      last_modified: "2026-10-09T00:00:00Z",
      project_id: "project",
      project_name: "Cross-feature",
    };
    const index = async (fetchImpl: typeof fetch) =>
      buildTeamIndexFile(
        {
          metadata,
          entry: await fetchTeamIndexEntry({
            token: "token",
            fileKey: "file",
            fetchImpl,
          }),
        },
        teamIndexSettings({}),
      );

    const wholeIndex = await index(whole.fetchImpl);
    expect(wholeIndex.componentUsages).toHaveLength(1);
    expect(await index(split.fetchImpl)).toEqual(wholeIndex);
  });

  it("fails a file whose node disappears during a split download", async () => {
    const { fetchImpl } = figmaServer({
      "": tooLarge,
      "?depth=1": () =>
        jsonResponse({
          document: node("0:0", [node("0:1")]),
          components: {},
          componentSets: {},
        }),
      "/nodes?ids=0:1": () => jsonResponse({ nodes: { "0:1": null } }),
    });

    await expect(
      fetchTeamIndexEntry({ token: "token", fileKey: "file", fetchImpl }),
    ).rejects.toThrow(
      "Figma node 0:1 disappeared while the file was downloaded.",
    );
  });

  it("names an oversized node that cannot be split", async () => {
    const { fetchImpl } = figmaServer({
      "": tooLarge,
      "?depth=1": () =>
        jsonResponse({
          document: node("0:0", [node("0:1")]),
          components: {},
          componentSets: {},
        }),
      "/nodes?ids=0:1": tooLarge,
      "/nodes?ids=0:1&depth=1": () =>
        nodesResponse({ "0:1": { document: node("0:1") } }),
    });

    const error = await fetchTeamIndexEntry({
      token: "token",
      fileKey: "file",
      fetchImpl,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FigmaResponseTooLargeError);
    expect((error as Error).message).toBe(
      "Figma node 0:1 in file file is too large to download and has no children to split.",
    );
  });
});
