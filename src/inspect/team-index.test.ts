import { describe, expect, it } from "vitest";
import type { FigmaTeamProjectFile } from "../figma-api/schemas.js";
import type { DocumentNode, FileNodeEntry } from "./schemas.js";
import { buildTeamIndex } from "./team-index.js";

function figmaNode(
  fields: Omit<DocumentNode, "isExposedInstance"> & {
    isExposedInstance?: boolean;
  },
): DocumentNode {
  return {
    isExposedInstance: false,
    ...fields,
  };
}

const fileMetadata: FigmaTeamProjectFile = {
  key: "file-key",
  name: "Settings",
  last_modified: "2026-06-17T12:43:44Z",
  project_id: "profile-project",
  project_name: "Profile",
};

function fileEntry(): FileNodeEntry {
  const cellVariant = figmaNode({
    id: "10:2",
    type: "COMPONENT",
    name: "State=Default",
  });
  const cellSet = figmaNode({
    id: "10:1",
    type: "COMPONENT_SET",
    name: "Cell",
    componentPropertyDefinitions: {
      State: { type: "VARIANT", variantOptions: ["Default", "Pressed"] },
    },
    children: [cellVariant],
  });
  const logoComponent = figmaNode({
    id: "11:1",
    type: "COMPONENT",
    name: "Logo",
  });
  const phoneScreen = figmaNode({
    id: "20:1",
    type: "FRAME",
    name: "Settings / Phone",
    absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 844 },
    layoutMode: "VERTICAL",
    children: [
      figmaNode({
        id: "20:2",
        type: "INSTANCE",
        name: "Cell instance",
        componentId: "10:2",
      }),
      figmaNode({
        id: "20:3",
        type: "FRAME",
        name: "Nested screen-sized card",
        absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
      }),
    ],
  });
  const tabletScreen = figmaNode({
    id: "21:1",
    type: "FRAME",
    name: "Settings / iPad",
    absoluteBoundingBox: { x: 0, y: 0, width: 834, height: 1194 },
    layoutMode: "VERTICAL",
    children: [
      figmaNode({
        id: "21:2",
        type: "INSTANCE",
        name: "Cell instance",
        componentId: "10:2",
      }),
      figmaNode({
        id: "21:3",
        type: "FRAME",
        name: "Nested screen-sized card",
        absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
      }),
    ],
  });

  return {
    document: figmaNode({
      id: "0:0",
      type: "DOCUMENT",
      name: "Document",
      children: [
        figmaNode({
          id: "0:1",
          type: "CANVAS",
          name: "Components",
          children: [cellSet, logoComponent],
        }),
        figmaNode({
          id: "0:2",
          type: "CANVAS",
          name: "Screens",
          children: [phoneScreen, tabletScreen],
        }),
      ],
    }),
    componentSets: {
      "10:1": {
        id: "10:1",
        key: "cell-set-key",
        name: "Cell",
      },
    },
    components: {
      "10:2": {
        key: "cell-variant-key",
        name: "Cell / Default",
        componentSetId: "10:1",
      },
      "11:1": {
        key: "logo-key",
        name: "Logo",
      },
    },
  };
}

describe("buildTeamIndex", () => {
  it("indexes component sets, standalone components, screens, and similar sizes", () => {
    const index = buildTeamIndex({
      teamId: "team",
      files: [{ metadata: fileMetadata, entry: fileEntry() }],
    });

    expect(index.team.files).toEqual([
      {
        key: "file-key",
        name: "Settings",
        lastModified: "2026-06-17T12:43:44Z",
        projectId: "profile-project",
        projectName: "Profile",
        componentSets: 1,
        components: 1,
        screens: 2,
      },
    ]);
    expect(index.files[0]?.componentSets).toEqual([
      {
        id: "10:1",
        name: "Cell",
        lastModified: "2026-06-17T12:43:44Z",
        url: "https://www.figma.com/design/file-key/Settings?node-id=10-1&m=dev",
      },
    ]);
    expect(index.files[0]?.components).toEqual([
      {
        id: "11:1",
        name: "Logo",
        lastModified: "2026-06-17T12:43:44Z",
        url: "https://www.figma.com/design/file-key/Settings?node-id=11-1&m=dev",
      },
    ]);
    expect(index.files[0]?.screens.map((screen) => screen.id)).toEqual([
      "20:1",
      "21:1",
    ]);
    expect(index.files[0]?.screenGroups).toEqual([
      {
        id: "file-key#20:1,21:1",
        screens: [
          {
            id: "20:1",
            name: "Settings / Phone",
            size: "390x844",
            lastModified: "2026-06-17T12:43:44Z",
            url: "https://www.figma.com/design/file-key/Settings?node-id=20-1&m=dev",
          },
          {
            id: "21:1",
            name: "Settings / iPad",
            size: "834x1194",
            lastModified: "2026-06-17T12:43:44Z",
            url: "https://www.figma.com/design/file-key/Settings?node-id=21-1&m=dev",
          },
        ],
      },
    ]);
    expect(index.files[0]?.screens[0]).toEqual({
      id: "20:1",
      name: "Settings / Phone",
      size: "390x844",
      group: "file-key#20:1,21:1",
      lastModified: "2026-06-17T12:43:44Z",
      url: "https://www.figma.com/design/file-key/Settings?node-id=20-1&m=dev",
    });
  });

  it("rejects invalid similarity options", () => {
    expect(() =>
      buildTeamIndex({
        teamId: "team",
        files: [{ metadata: fileMetadata, entry: fileEntry() }],
        screenSimilarityThreshold: 2,
      }),
    ).toThrow(/between 0 and 1/);
  });
});
