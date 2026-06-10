import { describe, expect, it } from "vitest";
import { FigmaApiError } from "./figma-api-error.js";
import {
  parseComponentSetMetadataResponse,
  parseFileComponentsResponse,
  parseFileImagesResponse,
  parseFilePagesResponse,
  parseProjectFilesResponse,
  parseTeamComponentSetsResponse,
  parseTeamProjectsResponse,
} from "./schemas.js";

describe("parseTeamProjectsResponse", () => {
  it("parses valid projects and coerces numeric ids", () => {
    expect(
      parseTeamProjectsResponse({
        projects: [{ id: 42, name: "Design System", file_count: 3 }],
      }),
    ).toEqual([{ id: "42", name: "Design System", file_count: 3 }]);
  });

  it("drops malformed project entries", () => {
    expect(
      parseTeamProjectsResponse({
        projects: [{ id: "1", name: "Valid" }, { id: "2" }],
      }),
    ).toEqual([{ id: "1", name: "Valid" }]);
  });

  it("throws FigmaApiError for invalid payloads", () => {
    expect(() => parseTeamProjectsResponse({ projects: "bad" })).toThrow(
      FigmaApiError,
    );
  });
});

describe("parseProjectFilesResponse", () => {
  it("parses file entries", () => {
    expect(
      parseProjectFilesResponse({
        files: [
          {
            key: "abc",
            name: "Library",
            last_modified: "2024-01-01T00:00:00Z",
          },
        ],
      }),
    ).toEqual([
      {
        key: "abc",
        name: "Library",
        last_modified: "2024-01-01T00:00:00Z",
      },
    ]);
  });
});

describe("parseFilePagesResponse", () => {
  it("keeps only CANVAS children as pages", () => {
    expect(
      parseFilePagesResponse({
        document: {
          children: [
            { type: "CANVAS", id: "1:1", name: "Page 1" },
            { type: "FRAME", id: "1:2", name: "Ignored" },
          ],
        },
      }),
    ).toEqual([{ id: "1:1", name: "Page 1" }]);
  });
});

describe("parseTeamComponentSetsResponse", () => {
  it("parses component sets and cursor", () => {
    expect(
      parseTeamComponentSetsResponse({
        meta: {
          component_sets: [
            {
              key: "set-key",
              file_key: "file-key",
              node_id: "1:2",
              name: "Button",
            },
          ],
          cursor: { after: 99 },
        },
      }),
    ).toEqual({
      componentSets: [
        {
          key: "set-key",
          file_key: "file-key",
          node_id: "1:2",
          name: "Button",
        },
      ],
      cursorAfter: "99",
    });
  });
});

describe("parseFileImagesResponse", () => {
  it("drops null image URLs and keeps err when present", () => {
    expect(
      parseFileImagesResponse({
        images: {
          "1:1": "https://cdn.example/a.png",
          "1:2": null,
        },
        err: "partial",
      }),
    ).toEqual({
      images: { "1:1": "https://cdn.example/a.png" },
      err: "partial",
    });
  });
});

describe("parseComponentSetMetadataResponse", () => {
  it("unwraps meta from the response envelope", () => {
    expect(
      parseComponentSetMetadataResponse({
        meta: {
          key: "set-key",
          file_key: "file-key",
          node_id: "1:2",
          name: "Button",
          updated_at: "2024-01-01T00:00:00Z",
        },
      }),
    ).toEqual({
      key: "set-key",
      file_key: "file-key",
      node_id: "1:2",
      name: "Button",
      updated_at: "2024-01-01T00:00:00Z",
    });
  });
});

describe("parseFileComponentsResponse", () => {
  it("maps containing component set node id from nested frame metadata", () => {
    expect(
      parseFileComponentsResponse({
        meta: {
          components: [
            {
              key: "variant-key",
              file_key: "file-key",
              node_id: "1:3",
              name: "State=Default",
              updated_at: "2024-01-01T00:00:00Z",
              containing_frame: {
                containingComponentSet: { nodeId: "1:2" },
              },
            },
          ],
        },
      }),
    ).toEqual([
      {
        key: "variant-key",
        file_key: "file-key",
        node_id: "1:3",
        name: "State=Default",
        updated_at: "2024-01-01T00:00:00Z",
        containing_component_set_node_id: "1:2",
      },
    ]);
  });
});
