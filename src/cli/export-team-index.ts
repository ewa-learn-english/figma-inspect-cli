import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isScalar, type Pair, stringify } from "yaml";
import { listTeamProjectFiles } from "../figma-api/list-team-project-files.js";
import { fetchFileEntry } from "../inspect/fetch-file-entry.js";
import {
  type BuildTeamIndexFileInput,
  buildTeamIndex,
  type TeamIndex,
  type TeamIndexFile,
} from "../inspect/index.js";

export interface ExportTeamIndexOptions {
  token: string;
  teamId: string;
  outputDir: string;
  screenSimilarityThreshold?: number;
  screenSizeTolerance?: number;
  fetchImpl?: typeof fetch;
}

export interface ExportTeamIndexResult {
  teamIndexPath: string;
  fileIndexPaths: string[];
  fileCount: number;
  componentSetCount: number;
  componentCount: number;
  screenCount: number;
}

interface TeamIndexOutputFile {
  key: string;
  name: string;
  lastModified: string;
  projectId: string;
  projectName: string;
  index: string;
  componentSets: number;
  components: number;
  screens: number;
}

interface TeamIndexOutput {
  version: 1;
  kind: "figma-team-index";
  team: string;
  files: TeamIndexOutputFile[];
}

const YAML_KEY_ORDER = [
  "version",
  "kind",
  "team",
  "file",
  "files",
  "key",
  "id",
  "name",
  "size",
  "group",
  "lastModified",
  "projectId",
  "projectName",
  "index",
  "componentSets",
  "componentSet",
  "components",
  "screens",
  "screenGroups",
  "componentUsages",
  "instance",
  "path",
  "variantProps",
  "ancestorChain",
  "layoutRisks",
  "url",
  "layoutMode",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "layoutAlign",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "maxWidth",
  "minWidth",
  "maxHeight",
  "minHeight",
  "severity",
  "nodePath",
  "message",
  "evidence",
];

const YAML_KEY_RANK = new Map(YAML_KEY_ORDER.map((key, index) => [key, index]));

function slugSegment(value: string): string {
  const slug = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "untitled";
}

function fileIndexFileNameFromParts({
  key,
  name,
  projectName,
}: {
  key: string;
  name: string;
  projectName: string;
}): string {
  return [
    slugSegment(projectName),
    slugSegment(name),
    slugSegment(key),
    "index.yaml",
  ].join(".");
}

function relativeFileIndexPath(file: {
  key: string;
  name: string;
  projectName: string;
}): string {
  return fileIndexFileNameFromParts(file);
}

function yamlKey(pair: Pair): string {
  return isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
}

function sortYamlMapEntries(left: Pair, right: Pair): number {
  const leftKey = yamlKey(left);
  const rightKey = yamlKey(right);
  const byRank =
    (YAML_KEY_RANK.get(leftKey) ?? Number.MAX_SAFE_INTEGER) -
    (YAML_KEY_RANK.get(rightKey) ?? Number.MAX_SAFE_INTEGER);

  return byRank === 0 ? leftKey.localeCompare(rightKey) : byRank;
}

function serializeIndex(value: TeamIndexOutput | TeamIndexFile): string {
  return stringify(value, { sortMapEntries: sortYamlMapEntries });
}

function teamIndexOutput(team: TeamIndex): TeamIndexOutput {
  return {
    version: team.version,
    kind: team.kind,
    team: team.team,
    files: team.files.map((file) => {
      return {
        key: file.key,
        name: file.name,
        lastModified: file.lastModified,
        projectId: file.projectId,
        projectName: file.projectName,
        index: relativeFileIndexPath(file),
        componentSets: file.componentSets,
        components: file.components,
        screens: file.screens,
      };
    }),
  };
}

export async function exportTeamIndex({
  token,
  teamId,
  outputDir,
  screenSimilarityThreshold,
  screenSizeTolerance,
  fetchImpl,
}: ExportTeamIndexOptions): Promise<ExportTeamIndexResult> {
  const files = await listTeamProjectFiles({ token, teamId, fetchImpl });
  const inputs: BuildTeamIndexFileInput[] = [];
  for (const metadata of files) {
    inputs.push({
      metadata,
      entry: await fetchFileEntry({
        token,
        fileKey: metadata.key,
        fetchImpl,
      }),
    });
  }

  const index = buildTeamIndex({
    teamId,
    files: inputs,
    screenSimilarityThreshold,
    screenSizeTolerance,
  });

  await mkdir(outputDir, { recursive: true });

  const fileIndexPaths: string[] = [];
  for (const fileIndex of index.files) {
    const relativePath = relativeFileIndexPath(fileIndex.file);
    const absolutePath = path.join(outputDir, relativePath);
    fileIndexPaths.push(absolutePath);
    await writeFile(absolutePath, serializeIndex(fileIndex), "utf8");
  }

  const teamIndexPath = path.join(outputDir, "team.index.yaml");
  await writeFile(
    teamIndexPath,
    serializeIndex(teamIndexOutput(index.team)),
    "utf8",
  );

  const componentSetCount = index.files.reduce(
    (total, file) => total + file.componentSets.length,
    0,
  );
  const componentCount = index.files.reduce(
    (total, file) => total + file.components.length,
    0,
  );
  const screenCount = index.files.reduce(
    (total, file) => total + file.screens.length,
    0,
  );

  return {
    teamIndexPath,
    fileIndexPaths,
    fileCount: index.files.length,
    componentSetCount,
    componentCount,
    screenCount,
  };
}
