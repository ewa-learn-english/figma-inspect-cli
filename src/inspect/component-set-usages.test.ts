import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compactComponentSetResponsiveUsage,
  compactComponentSetUsages,
  inspectComponentSetResponsiveUsage,
  listComponentSetUsages,
} from "./component-set-usages.js";
import type { TeamIndexBundle, TeamIndexFile } from "./team-index.js";
import {
  TEAM_INDEX_DATABASE_FILE,
  writeTeamIndexDatabase,
} from "./team-index-database.js";

let indexDir: string | undefined;

function leaguesFileIndex(): TeamIndexFile {
  return {
    version: 1,
    kind: "figma-file-index",
    file: {
      key: "file-key",
      name: "Leagues",
      lastModified: "2026-06-24T07:00:00Z",
      projectId: "cross-feature",
      projectName: "Cross-feature",
    },
    componentSets: [
      {
        id: "30:1",
        key: "ratings-divider-key",
        name: "RatingsDivider",
        lastModified: "2026-06-24T07:00:00Z",
        url: "https://www.figma.com/design/file-key/Leagues?node-id=30-1&m=dev",
      },
    ],
    components: [],
    screens: [
      {
        id: "40:1",
        name: "Leagues scroll / Phone",
        size: "375x812",
        group: "file-key#40:1,41:1",
        lastModified: "2026-06-24T07:00:00Z",
        url: "https://www.figma.com/design/file-key/Leagues?node-id=40-1&m=dev",
      },
      {
        id: "41:1",
        name: "Leagues scroll / iPad Landscape",
        size: "1194x834",
        group: "file-key#40:1,41:1",
        lastModified: "2026-06-24T07:00:00Z",
        url: "https://www.figma.com/design/file-key/Leagues?node-id=41-1&m=dev",
      },
    ],
    screenGroups: [
      {
        id: "file-key#40:1,41:1",
        screens: [
          {
            id: "40:1",
            name: "Leagues scroll / Phone",
            size: "375x812",
            lastModified: "2026-06-24T07:00:00Z",
            url: "https://www.figma.com/design/file-key/Leagues?node-id=40-1&m=dev",
          },
          {
            id: "41:1",
            name: "Leagues scroll / iPad Landscape",
            size: "1194x834",
            lastModified: "2026-06-24T07:00:00Z",
            url: "https://www.figma.com/design/file-key/Leagues?node-id=41-1&m=dev",
          },
        ],
      },
    ],
    componentUsages: [
      {
        componentSet: {
          id: "30:1",
          key: "ratings-divider-key",
          name: "RatingsDivider",
        },
        screen: {
          id: "41:1",
          name: "Leagues scroll / iPad Landscape",
          size: "1194x834",
          group: "file-key#40:1,41:1",
          lastModified: "2026-06-24T07:00:00Z",
          url: "https://www.figma.com/design/file-key/Leagues?node-id=41-1&m=dev",
        },
        instance: {
          id: "41:2",
          name: "RatingsDivider",
          path: "usersList.ratingsDivider",
        },
        ancestorChain: [],
        layoutRisks: [
          {
            type: "wide-breakpoint-sensitive",
            severity: "high",
            nodePath: "usersList.ratingsDivider.text",
            message:
              "The maxWidth constraint is active on wider screens and may be invisible on phone-sized checks.",
            evidence: {
              maxWidth: 520,
              affectedScreenSizes: ["1194x834"],
              safeScreenSizes: ["375x812"],
            },
          },
        ],
      },
    ],
  };
}

function unrelatedFileIndex(): TeamIndexFile {
  const screen = {
    id: "91:1",
    name: "Other screen",
    size: "375x812",
    group: null,
    lastModified: "2026-06-24T07:00:00Z",
    url: "https://www.figma.com/design/other-key/Other?node-id=91-1&m=dev",
  };

  return {
    version: 1,
    kind: "figma-file-index",
    file: {
      key: "other-key",
      name: "Other",
      lastModified: "2026-06-24T07:00:00Z",
      projectId: "profile",
      projectName: "Profile",
    },
    componentSets: [],
    components: [],
    screens: [screen],
    screenGroups: [],
    componentUsages: Array.from({ length: 200 }, (_, index) => ({
      componentSet: {
        id: "90:1",
        name: "OtherSet",
      },
      screen,
      instance: {
        id: `91:${index + 2}`,
        name: "OtherSet",
        path: `repeated.item${index + 1}`,
      },
      ancestorChain: [
        {
          path: "root",
          id: "91:1",
          name: "Other screen",
          type: "FRAME",
          layoutMode: "VERTICAL",
        },
      ],
    })),
  };
}

function teamIndexBundle(): TeamIndexBundle {
  const leagues = leaguesFileIndex();
  const unrelated = unrelatedFileIndex();
  return {
    team: {
      version: 1,
      kind: "figma-team-index",
      team: "team",
      files: [
        {
          ...leagues.file,
          componentSets: leagues.componentSets.length,
          components: leagues.components.length,
          screens: leagues.screens.length,
        },
        {
          ...unrelated.file,
          componentSets: unrelated.componentSets.length,
          components: unrelated.components.length,
          screens: unrelated.screens.length,
        },
      ],
    },
    files: [leagues, unrelated],
  };
}

async function writeIndex(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "figma-index-"));
  await writeTeamIndexDatabase({
    databasePath: path.join(directory, TEAM_INDEX_DATABASE_FILE),
    index: teamIndexBundle(),
  });
  return directory;
}

async function writeLegacyYamlIndex(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "figma-index-"));
  await writeFile(
    path.join(directory, "Cross-feature.Leagues.file-key.index.yaml"),
    [
      "version: 1",
      "kind: figma-file-index",
      "file:",
      "  key: file-key",
      "  name: Leagues",
      "componentUsages: []",
      "",
    ].join("\n"),
    "utf8",
  );
  return directory;
}

describe("component set usages", () => {
  beforeEach(async () => {
    indexDir = await writeIndex();
  });

  afterEach(async () => {
    if (indexDir) {
      await rm(indexDir, { recursive: true, force: true });
    }
  });

  it("lists usages from the local SQLite index by component set name", async () => {
    const usages = await listComponentSetUsages({
      indexDir: indexDir ?? "",
      componentSet: { kind: "name", value: "RatingsDivider" },
      screenGroup: "Leagues scroll",
    });

    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({
      file: {
        key: "file-key",
        name: "Leagues",
      },
      componentSet: {
        key: "ratings-divider-key",
        name: "RatingsDivider",
      },
      instance: {
        path: "usersList.ratingsDivider",
      },
    });
  });

  it("compacts usage lists for LLM output", async () => {
    const usages = await listComponentSetUsages({
      indexDir: indexDir ?? "",
      componentSet: { kind: "name", value: "RatingsDivider" },
      screenGroup: "Leagues scroll",
    });

    const summary = compactComponentSetUsages({
      componentSet: { kind: "name", value: "RatingsDivider" },
      usages,
    });

    expect(summary).toMatchObject({
      componentSet: {
        id: "30:1",
        key: "ratings-divider-key",
        name: "RatingsDivider",
      },
      usageCount: 1,
      files: [
        {
          key: "file-key",
          name: "Leagues",
          projectName: "Cross-feature",
          groups: [
            {
              id: "file-key#40:1,41:1",
              label: "Leagues scroll",
              sizes: ["1194x834"],
              screens: [
                {
                  name: "Leagues scroll / iPad Landscape",
                  size: "1194x834",
                  url: "https://www.figma.com/design/file-key/Leagues?node-id=41-1&m=dev",
                },
              ],
              usages: [
                {
                  screen: "1194x834",
                  screenName: "Leagues scroll / iPad Landscape",
                  path: "usersList.ratingsDivider",
                  risks: [
                    {
                      type: "wide-breakpoint-sensitive",
                      severity: "high",
                      nodePath: "usersList.ratingsDivider.text",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("ancestorChain");
    expect(JSON.stringify(summary)).not.toContain("maxWidth constraint");
  });

  it("groups responsive usage evidence and risks", async () => {
    const report = await inspectComponentSetResponsiveUsage({
      indexDir: indexDir ?? "",
      componentSet: { kind: "key", value: "ratings-divider-key" },
    });

    expect(report.groups).toEqual([
      expect.objectContaining({
        label: "Leagues scroll",
        sizes: ["1194x834", "375x812"],
        widths: [375, 1194],
        layoutRisks: [
          expect.objectContaining({
            type: "wide-breakpoint-sensitive",
            severity: "high",
            nodePath: "usersList.ratingsDivider.text",
          }),
        ],
      }),
    ]);
  });

  it("compacts responsive reports by instance and risk type", async () => {
    const report = await inspectComponentSetResponsiveUsage({
      indexDir: indexDir ?? "",
      componentSet: { kind: "key", value: "ratings-divider-key" },
    });

    const compact = compactComponentSetResponsiveUsage(report);

    expect(compact.groups).toEqual([
      expect.objectContaining({
        label: "Leagues scroll",
        sizes: ["1194x834", "375x812"],
        usageCount: 1,
        instances: [
          {
            path: "usersList.ratingsDivider",
            screens: ["1194x834"],
            risks: [
              {
                type: "wide-breakpoint-sensitive",
                severity: "high",
                nodePath: "usersList.ratingsDivider.text",
              },
            ],
          },
        ],
        risks: [
          {
            type: "wide-breakpoint-sensitive",
            severity: "high",
            count: 1,
            nodePaths: ["usersList.ratingsDivider.text"],
          },
        ],
      }),
    ]);
    expect(JSON.stringify(compact)).not.toContain("ancestorChain");
    expect(JSON.stringify(compact)).not.toContain("maxWidth constraint");
  });

  it("rejects removed YAML team indexes", async () => {
    const legacyIndexDir = await writeLegacyYamlIndex();
    try {
      await expect(
        listComponentSetUsages({
          indexDir: legacyIndexDir,
          componentSet: { kind: "name", value: "RatingsDivider" },
        }),
      ).rejects.toThrow(/removed YAML format/);
    } finally {
      await rm(legacyIndexDir, { recursive: true, force: true });
    }
  });
});
