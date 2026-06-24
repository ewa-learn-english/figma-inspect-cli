import { FigmaInspectError } from "./errors.js";
import type { TeamIndexComponentUsage, TeamIndexFile } from "./team-index.js";
import {
  readComponentUsageRecords,
  type TeamIndexUsageRecord,
} from "./team-index-database.js";
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
  file: Pick<TeamIndexUsageRecord, "screenGroups">,
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
  file: Pick<TeamIndexUsageRecord, "screenGroups">,
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
  record: Pick<TeamIndexUsageRecord, "file">,
  usage: TeamIndexComponentUsage,
): IndexedComponentSetUsage {
  return {
    file: record.file,
    ...usage,
  };
}

export async function listComponentSetUsages({
  indexDir,
  componentSet,
  screenGroup,
}: ListComponentSetUsagesOptions): Promise<IndexedComponentSetUsage[]> {
  const records = await readComponentUsageRecords({ indexDir, componentSet });
  return records
    .filter((record) => screenGroupMatches(record, record.usage, screenGroup))
    .map((record) => withFile(record, record.usage))
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
  file: Pick<TeamIndexUsageRecord, "screenGroups">,
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
  const records = await readComponentUsageRecords({
    indexDir: options.indexDir,
    componentSet: options.componentSet,
  });
  const groups = new Map<
    string,
    {
      file: Pick<TeamIndexUsageRecord, "file" | "screenGroups">;
      usages: IndexedComponentSetUsage[];
      groupId: string | null;
    }
  >();

  for (const record of records) {
    const usage = record.usage;
    if (!screenGroupMatches(record, usage, options.screenGroup)) {
      continue;
    }

    const groupId = usage.screen.group;
    const key = `${record.file.key}#${groupId ?? usage.screen.id}`;
    const current = groups.get(key) ?? {
      file: record,
      usages: [],
      groupId,
    };
    current.usages.push(withFile(record, usage));
    groups.set(key, current);
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
