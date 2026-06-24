import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { FigmaInspectError } from "./errors.js";
import type { TeamIndexComponentUsage, TeamIndexFile } from "./team-index.js";
import type { ComponentSetLookup } from "./types.js";

export interface IndexedComponentSetUsage extends TeamIndexComponentUsage {
  file: TeamIndexFile["file"];
}

export interface ListComponentSetUsagesOptions {
  indexDir: string;
  componentSet: ComponentSetLookup;
  screenGroup?: string;
}

interface ResponsiveUsageRisk {
  componentSet: IndexedComponentSetUsage["componentSet"];
  screen: IndexedComponentSetUsage["screen"];
  instance: IndexedComponentSetUsage["instance"];
  type: string;
  severity: string;
  nodePath: string;
  message: string;
  evidence: Record<string, unknown>;
}

interface ResponsiveUsageGroup {
  id: string;
  label: string;
  sizes: string[];
  widths: number[];
  screens: Array<{
    id: string;
    name: string;
    size: string;
    url: string;
  }>;
  usages: IndexedComponentSetUsage[];
  layoutRisks: ResponsiveUsageRisk[];
}

export interface ComponentSetResponsiveUsageReport {
  componentSet: ComponentSetLookup;
  groups: ResponsiveUsageGroup[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTeamIndexFile(value: unknown): value is TeamIndexFile {
  return (
    isRecord(value) &&
    value.kind === "figma-file-index" &&
    isRecord(value.file) &&
    Array.isArray(value.componentUsages)
  );
}

async function indexFilePaths(indexDir: string): Promise<string[]> {
  const entries = await readdir(indexDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (name) => name.endsWith(".index.yaml") && name !== "team.index.yaml",
    )
    .sort()
    .map((name) => path.join(indexDir, name));
}

async function readIndexFile(filePath: string): Promise<TeamIndexFile> {
  const parsed = parse(await readFile(filePath, "utf8"), {
    maxAliasCount: -1,
  });
  if (!isTeamIndexFile(parsed)) {
    throw new FigmaInspectError(
      `Invalid Figma file index ${path.basename(filePath)}.`,
    );
  }

  return parsed;
}

async function readIndexFiles(indexDir: string): Promise<TeamIndexFile[]> {
  const paths = await indexFilePaths(indexDir);
  if (paths.length === 0) {
    throw new FigmaInspectError(`No *.index.yaml files found in ${indexDir}.`);
  }

  return Promise.all(paths.map(readIndexFile));
}

function componentSetMatches(
  usage: TeamIndexComponentUsage,
  lookup: ComponentSetLookup,
): boolean {
  if (lookup.kind === "key") {
    return usage.componentSet.key === lookup.value;
  }

  return usage.componentSet.name === lookup.value;
}

function sharedScreenPrefix(names: readonly string[]): string | undefined {
  const prefixes = names
    .map((name) => name.split("/")[0]?.trim())
    .filter((name): name is string => Boolean(name));
  const first = prefixes[0];
  if (!first) {
    return undefined;
  }

  return prefixes.every((prefix) => prefix === first) ? first : undefined;
}

function screenGroupLabel(
  file: TeamIndexFile,
  groupId: string | null,
  fallbackScreenName: string,
): string {
  if (!groupId) {
    return fallbackScreenName;
  }

  const group = file.screenGroups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return groupId;
  }

  return (
    sharedScreenPrefix(group.screens.map((screen) => screen.name)) ?? groupId
  );
}

function screenGroupMatches(
  file: TeamIndexFile,
  usage: TeamIndexComponentUsage,
  expected: string | undefined,
): boolean {
  if (!expected) {
    return true;
  }

  if (usage.screen.group === expected || usage.screen.name === expected) {
    return true;
  }

  const label = screenGroupLabel(file, usage.screen.group, usage.screen.name);
  if (label === expected || usage.screen.name.startsWith(`${expected} /`)) {
    return true;
  }

  const group = file.screenGroups.find(
    (candidate) => candidate.id === usage.screen.group,
  );
  return (
    group?.screens.some(
      (screen) =>
        screen.name === expected || screen.name.startsWith(`${expected} /`),
    ) ?? false
  );
}

function withFile(
  file: TeamIndexFile,
  usage: TeamIndexComponentUsage,
): IndexedComponentSetUsage {
  return {
    file: file.file,
    ...usage,
  };
}

export async function listComponentSetUsages({
  indexDir,
  componentSet,
  screenGroup,
}: ListComponentSetUsagesOptions): Promise<IndexedComponentSetUsage[]> {
  const files = await readIndexFiles(indexDir);
  return files
    .flatMap((file) =>
      file.componentUsages
        .filter((usage) => componentSetMatches(usage, componentSet))
        .filter((usage) => screenGroupMatches(file, usage, screenGroup))
        .map((usage) => withFile(file, usage)),
    )
    .sort((left, right) => {
      const byFile = left.file.key.localeCompare(right.file.key);
      if (byFile !== 0) {
        return byFile;
      }
      const byScreen = left.screen.id.localeCompare(right.screen.id);
      return byScreen === 0
        ? left.instance.path.localeCompare(right.instance.path)
        : byScreen;
    });
}

function screenWidth(size: string): number | undefined {
  const [rawWidth] = size.split("x");
  const width = Number(rawWidth);
  return Number.isFinite(width) ? width : undefined;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function groupScreens(
  file: TeamIndexFile,
  groupId: string | null,
  usage: TeamIndexComponentUsage,
): ResponsiveUsageGroup["screens"] {
  const group = file.screenGroups.find((candidate) => candidate.id === groupId);
  const screens = group?.screens.map((screen) => ({
    id: screen.id,
    name: screen.name,
    size: screen.size,
    url: screen.url,
  })) ?? [
    {
      id: usage.screen.id,
      name: usage.screen.name,
      size: usage.screen.size,
      url: usage.screen.url,
    },
  ];

  return screens.sort((left, right) => left.id.localeCompare(right.id));
}

function responsiveRisk(
  usage: IndexedComponentSetUsage,
  risk: NonNullable<TeamIndexComponentUsage["layoutRisks"]>[number],
): ResponsiveUsageRisk {
  return {
    componentSet: usage.componentSet,
    screen: usage.screen,
    instance: usage.instance,
    type: risk.type,
    severity: risk.severity,
    nodePath: risk.nodePath,
    message: risk.message,
    evidence: risk.evidence,
  };
}

export async function inspectComponentSetResponsiveUsage(
  options: ListComponentSetUsagesOptions,
): Promise<ComponentSetResponsiveUsageReport> {
  const files = await readIndexFiles(options.indexDir);
  const groups = new Map<
    string,
    {
      file: TeamIndexFile;
      usages: IndexedComponentSetUsage[];
      groupId: string | null;
    }
  >();

  for (const file of files) {
    for (const usage of file.componentUsages) {
      if (
        !componentSetMatches(usage, options.componentSet) ||
        !screenGroupMatches(file, usage, options.screenGroup)
      ) {
        continue;
      }

      const groupId = usage.screen.group;
      const key = `${file.file.key}#${groupId ?? usage.screen.id}`;
      const current = groups.get(key) ?? {
        file,
        usages: [],
        groupId,
      };
      current.usages.push(withFile(file, usage));
      groups.set(key, current);
    }
  }

  const reportGroups = [...groups.entries()]
    .map(([id, group]): ResponsiveUsageGroup => {
      const firstUsage = group.usages[0];
      if (!firstUsage) {
        throw new FigmaInspectError("Cannot build empty usage group.");
      }

      const screens = groupScreens(group.file, group.groupId, firstUsage);
      const sizes = uniqueSorted(screens.map((screen) => screen.size));
      const widths = [
        ...new Set(
          sizes
            .map(screenWidth)
            .filter((width): width is number => width !== undefined),
        ),
      ].sort((left, right) => left - right);

      return {
        id,
        label: screenGroupLabel(
          group.file,
          group.groupId,
          firstUsage.screen.name,
        ),
        sizes,
        widths,
        screens,
        usages: group.usages.sort((left, right) =>
          left.instance.path.localeCompare(right.instance.path),
        ),
        layoutRisks: group.usages.flatMap((usage) =>
          (usage.layoutRisks ?? []).map((risk) => responsiveRisk(usage, risk)),
        ),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    componentSet: options.componentSet,
    groups: reportGroups,
  };
}
