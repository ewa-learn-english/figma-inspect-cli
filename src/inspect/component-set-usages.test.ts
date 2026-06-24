import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import {
  inspectComponentSetResponsiveUsage,
  listComponentSetUsages,
} from "./component-set-usages.js";

let indexDir: string | undefined;

async function writeIndex(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "figma-index-"));
  await writeFile(
    path.join(directory, "Cross-feature.Leagues.file-key.index.yaml"),
    stringify({
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
    }),
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

  it("lists usages from local index files by component set name", async () => {
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
});
