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

interface CompactComponentSetRef {
  id?: string;
  key?: string;
  name?: string;
}

interface CompactUsageRisk {
  type: string;
  severity: string;
  nodePath: string;
}

interface CompactUsageScreen {
  name: string;
  size: string;
  url: string;
}

interface CompactComponentSetUsage {
  screen: string;
  screenName: string;
  path: string;
  variantProps?: Record<string, boolean | string>;
  risks?: CompactUsageRisk[];
}

interface CompactComponentSetUsageGroup {
  id: string;
  label: string;
  sizes: string[];
  screens: CompactUsageScreen[];
  usages: CompactComponentSetUsage[];
}

interface CompactComponentSetUsageFile {
  key: string;
  name: string;
  projectName: string;
  groups: CompactComponentSetUsageGroup[];
}

export interface CompactComponentSetUsageSummary {
  componentSet: CompactComponentSetRef;
  usageCount: number;
  files: CompactComponentSetUsageFile[];
}

interface CompactResponsiveInstance {
  path: string;
  variantProps?: Record<string, boolean | string>;
  screens: string[];
  risks?: CompactUsageRisk[];
}

interface CompactResponsiveRiskSummary {
  type: string;
  severity: string;
  count: number;
  nodePaths: string[];
}

interface CompactResponsiveUsageGroup {
  id: string;
  label: string;
  sizes: string[];
  widths: number[];
  screens: ResponsiveUsageGroup["screens"];
  usageCount: number;
  instances: CompactResponsiveInstance[];
  risks: CompactResponsiveRiskSummary[];
}

export interface CompactComponentSetResponsiveUsageReport {
  componentSet: CompactComponentSetRef;
  groups: CompactResponsiveUsageGroup[];
}

function compactComponentSetRef(
  lookup: ComponentSetLookup,
  usages: readonly IndexedComponentSetUsage[],
): CompactComponentSetRef {
  const first = usages[0]?.componentSet;
  if (first) {
    return {
      id: first.id,
      ...(first.key ? { key: first.key } : {}),
      name: first.name,
    };
  }

  return lookup.kind === "key" ? { key: lookup.value } : { name: lookup.value };
}

function compactRisk(
  risk: NonNullable<TeamIndexComponentUsage["layoutRisks"]>[number],
): CompactUsageRisk {
  return {
    type: risk.type,
    severity: risk.severity,
    nodePath: risk.nodePath,
  };
}

function compactRisks(
  risks: TeamIndexComponentUsage["layoutRisks"],
): CompactUsageRisk[] | undefined {
  if (!risks || risks.length === 0) {
    return undefined;
  }

  return risks.map(compactRisk);
}

function sortedVariantProps(
  props: Record<string, boolean | string> | undefined,
): Record<string, boolean | string> | undefined {
  if (!props) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(props).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function variantPropsKey(
  props: Record<string, boolean | string> | undefined,
): string {
  return JSON.stringify(sortedVariantProps(props) ?? {});
}

function uniqueSortedBy<T>(
  records: readonly T[],
  key: (record: T) => string,
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const record of records) {
    const recordKey = key(record);
    if (seen.has(recordKey)) {
      continue;
    }

    seen.add(recordKey);
    unique.push(record);
  }

  return unique.sort((left, right) => key(left).localeCompare(key(right)));
}

function groupLabelFromUsages(
  groupId: string,
  usages: readonly IndexedComponentSetUsage[],
): string {
  return (
    sharedScreenPrefix(usages.map((usage) => usage.screen.name)) ??
    usages[0]?.screen.name ??
    groupId
  );
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

export function compactComponentSetUsages({
  componentSet,
  usages,
}: {
  componentSet: ComponentSetLookup;
  usages: readonly IndexedComponentSetUsage[];
}): CompactComponentSetUsageSummary {
  const files = new Map<string, IndexedComponentSetUsage[]>();
  for (const usage of usages) {
    const records = files.get(usage.file.key) ?? [];
    records.push(usage);
    files.set(usage.file.key, records);
  }

  return {
    componentSet: compactComponentSetRef(componentSet, usages),
    usageCount: usages.length,
    files: [...files.entries()]
      .map(([fileKey, fileUsages]): CompactComponentSetUsageFile => {
        const firstUsage = fileUsages[0];
        if (!firstUsage) {
          throw new FigmaInspectError("Cannot compact an empty usage file.");
        }

        const groups = new Map<string, IndexedComponentSetUsage[]>();
        for (const usage of fileUsages) {
          const groupId = usage.screen.group ?? usage.screen.id;
          const records = groups.get(groupId) ?? [];
          records.push(usage);
          groups.set(groupId, records);
        }

        return {
          key: fileKey,
          name: firstUsage.file.name,
          projectName: firstUsage.file.projectName,
          groups: [...groups.entries()]
            .map(([groupId, groupUsages]): CompactComponentSetUsageGroup => {
              const screens = uniqueSortedBy(
                groupUsages.map((usage) => ({
                  name: usage.screen.name,
                  size: usage.screen.size,
                  url: usage.screen.url,
                })),
                (screen) => `${screen.size}#${screen.name}`,
              );

              return {
                id: groupId,
                label: groupLabelFromUsages(groupId, groupUsages),
                sizes: uniqueSorted(screens.map((screen) => screen.size)),
                screens,
                usages: groupUsages
                  .map((usage): CompactComponentSetUsage => {
                    const risks = compactRisks(usage.layoutRisks);
                    return {
                      screen: usage.screen.size,
                      screenName: usage.screen.name,
                      path: usage.instance.path,
                      ...(usage.instance.variantProps
                        ? {
                            variantProps: sortedVariantProps(
                              usage.instance.variantProps,
                            ),
                          }
                        : {}),
                      ...(risks ? { risks } : {}),
                    };
                  })
                  .sort((left, right) => {
                    const byScreen = left.screen.localeCompare(right.screen);
                    return byScreen === 0
                      ? left.path.localeCompare(right.path)
                      : byScreen;
                  }),
              };
            })
            .sort((left, right) => left.id.localeCompare(right.id)),
        };
      })
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
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

export function compactComponentSetResponsiveUsage(
  report: ComponentSetResponsiveUsageReport,
): CompactComponentSetResponsiveUsageReport {
  const usages = report.groups.flatMap((group) => group.usages);
  return {
    componentSet: compactComponentSetRef(report.componentSet, usages),
    groups: report.groups.map((group): CompactResponsiveUsageGroup => {
      const instances = new Map<string, IndexedComponentSetUsage[]>();
      for (const usage of group.usages) {
        const key = `${usage.instance.path}#${variantPropsKey(
          usage.instance.variantProps,
        )}`;
        const records = instances.get(key) ?? [];
        records.push(usage);
        instances.set(key, records);
      }

      const risks = new Map<string, ResponsiveUsageRisk[]>();
      for (const risk of group.layoutRisks) {
        const key = `${risk.type}#${risk.severity}`;
        const records = risks.get(key) ?? [];
        records.push(risk);
        risks.set(key, records);
      }

      return {
        id: group.id,
        label: group.label,
        sizes: group.sizes,
        widths: group.widths,
        screens: group.screens,
        usageCount: group.usages.length,
        instances: [...instances.values()]
          .map((records): CompactResponsiveInstance => {
            const first = records[0];
            if (!first) {
              throw new FigmaInspectError(
                "Cannot compact an empty responsive instance.",
              );
            }

            const instanceRisks = compactRisks(
              records.flatMap((record) => record.layoutRisks ?? []),
            );
            return {
              path: first.instance.path,
              ...(first.instance.variantProps
                ? {
                    variantProps: sortedVariantProps(
                      first.instance.variantProps,
                    ),
                  }
                : {}),
              screens: uniqueSorted(
                records.map((record) => record.screen.size),
              ),
              ...(instanceRisks ? { risks: instanceRisks } : {}),
            };
          })
          .sort((left, right) => left.path.localeCompare(right.path)),
        risks: [...risks.values()]
          .map((records): CompactResponsiveRiskSummary => {
            const first = records[0];
            if (!first) {
              throw new FigmaInspectError(
                "Cannot compact an empty risk group.",
              );
            }

            return {
              type: first.type,
              severity: first.severity,
              count: records.length,
              nodePaths: uniqueSorted(records.map((record) => record.nodePath)),
            };
          })
          .sort((left, right) => {
            const bySeverity = left.severity.localeCompare(right.severity);
            return bySeverity === 0
              ? left.type.localeCompare(right.type)
              : bySeverity;
          }),
      };
    }),
  };
}
