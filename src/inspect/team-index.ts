import type { FigmaTeamProjectFile } from "../figma-api/schemas.js";
import {
  readNumber,
  readRecord,
  readString,
} from "./component-set-spec/figma-node.js";
import { FigmaInspectError } from "./errors.js";
import {
  type LayoutContext,
  type LayoutRisk,
  layoutContext,
  layoutRisksForUsage,
  readVariantProps,
} from "./layout-risks.js";
import type { DocumentNode, FileNodeEntry } from "./schemas.js";

const DEFAULT_SCREEN_SIMILARITY_THRESHOLD = 0.9;
const DEFAULT_SCREEN_SIZE_TOLERANCE = 2;

const SCREEN_SIZE_PRESETS = [
  [375, 916],
  [375, 854],
  [375, 812],
  [375, 667],
  [390, 844],
  [428, 926],
  [834, 1194],
  [1194, 834],
] as const;

export interface BuildTeamIndexFileInput {
  metadata: FigmaTeamProjectFile;
  entry: FileNodeEntry;
}

export interface BuildTeamIndexOptions {
  teamId: string;
  files: readonly BuildTeamIndexFileInput[];
  screenSimilarityThreshold?: number;
  screenSizeTolerance?: number;
}

interface TeamIndexFileSummary {
  key: string;
  name: string;
  lastModified: string;
  projectId: string;
  projectName: string;
  componentSets: number;
  components: number;
  screens: number;
}

interface TeamIndexNode {
  id: string;
  key?: string;
  name: string;
  lastModified: string;
  url: string;
}

interface TeamIndexScreen {
  id: string;
  name: string;
  size: string;
  group: string | null;
  lastModified: string;
  url: string;
}

interface TeamIndexScreenGroup {
  id: string;
  screens: TeamIndexScreenGroupScreen[];
}

interface TeamIndexScreenGroupScreen {
  id: string;
  name: string;
  size: string;
  lastModified: string;
  url: string;
}

interface TeamIndexUsageComponentSet {
  id: string;
  key?: string;
  name: string;
}

interface TeamIndexUsageInstance {
  id: string;
  name: string;
  path: string;
  variantProps?: Record<string, boolean | string>;
}

export interface TeamIndexComponentUsage {
  componentSet: TeamIndexUsageComponentSet;
  screen: TeamIndexScreen;
  instance: TeamIndexUsageInstance;
  ancestorChain: LayoutContext[];
  layoutRisks?: LayoutRisk[];
}

interface TeamIndexFileRef {
  key: string;
  name: string;
  lastModified: string;
  projectId: string;
  projectName: string;
}

export interface TeamIndexFile {
  version: 1;
  kind: "figma-file-index";
  file: TeamIndexFileRef;
  componentSets: TeamIndexNode[];
  components: TeamIndexNode[];
  screens: TeamIndexScreen[];
  screenGroups: TeamIndexScreenGroup[];
  componentUsages: TeamIndexComponentUsage[];
}

interface TeamIndex {
  version: 1;
  kind: "figma-team-index";
  team: string;
  files: TeamIndexFileSummary[];
}

export interface TeamIndexBundle {
  team: TeamIndex;
  files: TeamIndexFile[];
}

interface FoundNode {
  fileKey: string;
  fileName: string;
  lastModified: string;
  projectId: string;
  projectName: string;
  nodeId: string;
  key?: string;
  name: string;
  url: string;
}

interface FoundScreen extends FoundNode {
  size: string;
  structureTokens: string[];
  componentTokens: string[];
  groupId?: string;
}

interface DraftFile {
  metadata: FigmaTeamProjectFile;
  componentSets: FoundNode[];
  components: FoundNode[];
  screens: FoundScreen[];
  componentUsages: FoundComponentUsage[];
}

interface TraversalContext {
  parentComponentSetId?: string;
  insideScreen: boolean;
  currentScreen?: FoundScreen;
  path: string;
  ancestors: LayoutContext[];
  parentNode?: DocumentNode;
}

interface UsageComponentSet {
  id: string;
  key?: string;
  name: string;
}

interface FoundComponentUsage {
  componentSet: UsageComponentSet;
  screen: FoundScreen;
  node: DocumentNode;
  parentNode?: DocumentNode;
  instance: {
    id: string;
    name: string;
    path: string;
    variantProps?: Record<string, boolean | string>;
  };
  ancestorChain: LayoutContext[];
}

function assertTeamIndexOptions(
  threshold: number,
  sizeTolerance: number,
): void {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new FigmaInspectError(
      "Screen similarity threshold must be a number between 0 and 1.",
    );
  }

  if (!Number.isFinite(sizeTolerance) || sizeTolerance < 0) {
    throw new FigmaInspectError(
      "Screen size tolerance must be a non-negative number.",
    );
  }
}

function figmaNodeUrl(
  fileKey: string,
  fileName: string,
  nodeId: string,
): string {
  const url = new URL(
    `https://www.figma.com/design/${encodeURIComponent(fileKey)}/${encodeURIComponent(fileName)}`,
  );
  url.searchParams.set("node-id", nodeId.replace(/:/g, "-"));
  url.searchParams.set("m", "dev");
  return url.toString();
}

function nodeName(node: DocumentNode): string {
  return readString(node, "name") ?? "Untitled";
}

function nodeType(node: DocumentNode): string {
  return readString(node, "type") ?? "UNKNOWN";
}

function nodeId(node: DocumentNode): string | undefined {
  return readString(node, "id");
}

function foundNode(
  file: FigmaTeamProjectFile,
  node: DocumentNode,
  entry: FileNodeEntry,
): FoundNode | undefined {
  const id = nodeId(node);
  if (!id) {
    return undefined;
  }

  return {
    fileKey: file.key,
    fileName: file.name,
    lastModified: file.last_modified,
    projectId: file.project_id,
    projectName: file.project_name,
    nodeId: id,
    ...(entry.componentSets[id]?.key
      ? { key: entry.componentSets[id].key }
      : {}),
    ...(entry.components[id]?.key ? { key: entry.components[id].key } : {}),
    name: nodeName(node),
    url: figmaNodeUrl(file.key, file.name, id),
  };
}

function screenSize(node: DocumentNode): string | undefined {
  const box = readRecord(node, "absoluteBoundingBox");
  if (!box) {
    return undefined;
  }

  const width = readNumber(box, "width");
  const height = readNumber(box, "height");
  if (width === undefined || height === undefined) {
    return undefined;
  }

  return `${Math.round(width)}x${Math.round(height)}`;
}

function isScreenSize(
  node: DocumentNode,
  tolerance: number,
): string | undefined {
  const box = readRecord(node, "absoluteBoundingBox");
  if (!box) {
    return undefined;
  }

  const width = readNumber(box, "width");
  const height = readNumber(box, "height");
  if (width === undefined || height === undefined) {
    return undefined;
  }

  const preset = SCREEN_SIZE_PRESETS.find(
    ([presetWidth, presetHeight]) =>
      Math.abs(presetWidth - width) <= tolerance &&
      Math.abs(presetHeight - height) <= tolerance,
  );

  return preset ? screenSize(node) : undefined;
}

function instanceIdentity(
  node: DocumentNode,
  entry: FileNodeEntry,
): string | undefined {
  const componentId = readString(node, "componentId");
  if (!componentId) {
    return undefined;
  }

  const component = entry.components[componentId];
  const componentSet = component?.componentSetId
    ? entry.componentSets[component.componentSetId]
    : undefined;

  return (
    componentSet?.key ??
    componentSet?.name ??
    component?.key ??
    component?.name ??
    componentId
  );
}

function structureToken(node: DocumentNode, entry: FileNodeEntry): string {
  const type = nodeType(node);
  if (type !== "INSTANCE") {
    return type;
  }

  const identity = instanceIdentity(node, entry);
  return identity ? `INSTANCE:${identity}` : "INSTANCE";
}

function structureTokens(node: DocumentNode, entry: FileNodeEntry): string[] {
  return [
    structureToken(node, entry),
    ...(node.children ?? []).flatMap((child) => structureTokens(child, entry)),
  ];
}

function componentTokens(node: DocumentNode, entry: FileNodeEntry): string[] {
  const current =
    nodeType(node) === "INSTANCE" ? [structureToken(node, entry)] : [];
  return [
    ...current,
    ...(node.children ?? []).flatMap((child) => componentTokens(child, entry)),
  ];
}

function pathSegment(raw: string | undefined, fallback: string): string {
  const words = (raw ?? fallback)
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return fallback;
  }

  return words
    .map((word, index) => {
      const lower = word.charAt(0).toLowerCase() + word.slice(1);
      return index === 0
        ? lower
        : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function childPath(
  parentPath: string,
  child: DocumentNode,
  index: number,
  siblingCounts: Map<string, number>,
): string {
  const segment = pathSegment(readString(child, "name"), `child${index + 1}`);
  const nextCount = (siblingCounts.get(segment) ?? 0) + 1;
  siblingCounts.set(segment, nextCount);
  const uniqueSegment = nextCount === 1 ? segment : `${segment}${nextCount}`;
  return parentPath === "root"
    ? uniqueSegment
    : `${parentPath}.${uniqueSegment}`;
}

function instanceComponentSet(
  node: DocumentNode,
  entry: FileNodeEntry,
): UsageComponentSet | undefined {
  const componentId = readString(node, "componentId");
  if (!componentId) {
    return undefined;
  }

  const component = entry.components[componentId];
  const componentSetId = component?.componentSetId;
  if (!componentSetId) {
    return undefined;
  }

  const componentSet = entry.componentSets[componentSetId];
  if (!componentSet) {
    return undefined;
  }

  return {
    id: componentSet.id,
    key: componentSet.key,
    name: componentSet.name,
  };
}

function foundComponentUsage(options: {
  node: DocumentNode;
  entry: FileNodeEntry;
  screen: FoundScreen;
  path: string;
  ancestorChain: LayoutContext[];
  parentNode?: DocumentNode;
}): FoundComponentUsage | undefined {
  const id = nodeId(options.node);
  if (!id) {
    return undefined;
  }

  const componentSet = instanceComponentSet(options.node, options.entry);
  if (!componentSet) {
    return undefined;
  }

  const variantProps = readVariantProps(options.node);
  return {
    componentSet,
    screen: options.screen,
    node: options.node,
    ...(options.parentNode ? { parentNode: options.parentNode } : {}),
    instance: {
      id,
      name: nodeName(options.node),
      path: options.path,
      ...(variantProps ? { variantProps } : {}),
    },
    ancestorChain: options.ancestorChain,
  };
}

function buildDraftFile(
  input: BuildTeamIndexFileInput,
  sizeTolerance: number,
): DraftFile {
  const { metadata: file, entry } = input;
  const root = entry.document;
  if (!root) {
    throw new FigmaInspectError(`Figma file ${file.key} has no document.`);
  }

  const componentSets: FoundNode[] = [];
  const components: FoundNode[] = [];
  const screens: FoundScreen[] = [];
  const componentUsages: FoundComponentUsage[] = [];

  function visit(node: DocumentNode, context: TraversalContext): void {
    const type = nodeType(node);
    const base = foundNode(file, node, entry);

    if (base && type === "COMPONENT_SET") {
      componentSets.push(base);
    }

    if (
      base &&
      type === "COMPONENT" &&
      context.parentComponentSetId === undefined
    ) {
      components.push(base);
    }

    const size =
      base && type === "FRAME" && !context.insideScreen
        ? isScreenSize(node, sizeTolerance)
        : undefined;
    if (base && size) {
      const screen = {
        ...base,
        size,
        structureTokens: structureTokens(node, entry),
        componentTokens: componentTokens(node, entry),
      };
      screens.push(screen);
    }

    const screen =
      base && size ? screens[screens.length - 1] : context.currentScreen;
    const path = base && size ? "root" : context.path;
    const ancestors = base && size ? [] : context.ancestors;

    if (type === "INSTANCE" && screen) {
      const usage = foundComponentUsage({
        node,
        entry,
        screen,
        path,
        ancestorChain: ancestors.slice(-5),
        parentNode: context.parentNode,
      });
      if (usage) {
        componentUsages.push(usage);
      }
    }

    const childContext: TraversalContext = {
      parentComponentSetId:
        type === "COMPONENT_SET" && base
          ? base.nodeId
          : context.parentComponentSetId,
      insideScreen: context.insideScreen || size !== undefined,
      currentScreen: screen,
      path,
      ancestors: screen
        ? [...ancestors, layoutContext(node, path)].slice(-5)
        : [],
      parentNode: node,
    };

    const siblingCounts = new Map<string, number>();
    for (const [index, child] of (node.children ?? []).entries()) {
      visit(child, {
        ...childContext,
        path: screen ? childPath(path, child, index, siblingCounts) : "root",
      });
    }
  }

  for (const page of root.children ?? []) {
    for (const child of page.children ?? []) {
      visit(child, {
        insideScreen: false,
        path: "root",
        ancestors: [],
      });
    }
  }

  return {
    metadata: file,
    componentSets: sortNodesById(componentSets),
    components: sortNodesById(components),
    screens: sortNodesById(screens),
    componentUsages: sortComponentUsages(componentUsages),
  };
}

function sortNodesById<T extends FoundNode>(records: T[]): T[] {
  return [...records].sort((left, right) =>
    left.nodeId.localeCompare(right.nodeId),
  );
}

function sortComponentUsages(
  records: FoundComponentUsage[],
): FoundComponentUsage[] {
  return [...records].sort((left, right) => {
    const byComponent = left.componentSet.name.localeCompare(
      right.componentSet.name,
    );
    if (byComponent !== 0) {
      return byComponent;
    }

    const byScreen = left.screen.nodeId.localeCompare(right.screen.nodeId);
    return byScreen === 0
      ? left.instance.path.localeCompare(right.instance.path)
      : byScreen;
  });
}

function multisetSimilarity(left: readonly string[], right: readonly string[]) {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }

  const leftCounts = new Map<string, number>();
  const rightCounts = new Map<string, number>();
  for (const token of left) {
    leftCounts.set(token, (leftCounts.get(token) ?? 0) + 1);
  }
  for (const token of right) {
    rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  }

  const tokens = new Set([...leftCounts.keys(), ...rightCounts.keys()]);
  let intersection = 0;
  let union = 0;
  for (const token of tokens) {
    const leftCount = leftCounts.get(token) ?? 0;
    const rightCount = rightCounts.get(token) ?? 0;
    intersection += Math.min(leftCount, rightCount);
    union += Math.max(leftCount, rightCount);
  }

  return union === 0 ? 1 : intersection / union;
}

function sequenceSimilarity(left: readonly string[], right: readonly string[]) {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  let matches = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] === right[index]) {
      matches += 1;
    }
  }

  return matches / maxLength;
}

function countSimilarity(left: number, right: number): number {
  if (left === 0 && right === 0) {
    return 1;
  }

  return Math.min(left, right) / Math.max(left, right);
}

function screenSimilarity(left: FoundScreen, right: FoundScreen): number {
  return (
    multisetSimilarity(left.structureTokens, right.structureTokens) * 0.45 +
    sequenceSimilarity(left.structureTokens, right.structureTokens) * 0.25 +
    multisetSimilarity(left.componentTokens, right.componentTokens) * 0.2 +
    countSimilarity(left.structureTokens.length, right.structureTokens.length) *
      0.1
  );
}

function screenRef(screen: Pick<FoundScreen, "fileKey" | "nodeId">): string {
  return `${screen.fileKey}#${screen.nodeId}`;
}

function screenGroupId(screens: readonly FoundScreen[]): string {
  const first = screens[0];
  if (!first) {
    throw new FigmaInspectError("Cannot build an empty screen group id.");
  }

  const nodeIds = screens.map((screen) => screen.nodeId).sort();
  return `${first.fileKey}#${nodeIds.join(",")}`;
}

function assignFileScreenGroups(
  file: DraftFile,
  threshold: number,
): TeamIndexScreenGroup[] {
  const screens = file.screens;
  const parent = new Map(
    screens.map((screen) => [screenRef(screen), screenRef(screen)]),
  );

  function find(key: string): string {
    const current = parent.get(key);
    if (!current || current === key) {
      return key;
    }

    const root = find(current);
    parent.set(key, root);
    return root;
  }

  function union(left: FoundScreen, right: FoundScreen): void {
    const leftRoot = find(screenRef(left));
    const rightRoot = find(screenRef(right));
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  }

  for (let leftIndex = 0; leftIndex < screens.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < screens.length;
      rightIndex += 1
    ) {
      const left = screens[leftIndex];
      const right = screens[rightIndex];
      if (screenSimilarity(left, right) >= threshold) {
        union(left, right);
      }
    }
  }

  const groupsByRoot = new Map<string, FoundScreen[]>();
  for (const screen of screens) {
    const root = find(screenRef(screen));
    const members = groupsByRoot.get(root) ?? [];
    members.push(screen);
    groupsByRoot.set(root, members);
  }

  const groups = [...groupsByRoot.values()]
    .filter((members) => members.length > 1)
    .map((members) => sortNodesById(members))
    .sort((left, right) =>
      screenGroupId(left).localeCompare(screenGroupId(right)),
    );

  return groups.map((members) => {
    const id = screenGroupId(members);
    for (const member of members) {
      member.groupId = id;
    }

    return {
      id,
      screens: members.map(screenGroupScreen),
    };
  });
}

function indexNode(node: FoundNode): TeamIndexNode {
  return {
    id: node.nodeId,
    ...(node.key ? { key: node.key } : {}),
    name: node.name,
    lastModified: node.lastModified,
    url: node.url,
  };
}

function indexScreen(screen: FoundScreen): TeamIndexScreen {
  return {
    id: screen.nodeId,
    name: screen.name,
    size: screen.size,
    group: screen.groupId ?? null,
    lastModified: screen.lastModified,
    url: screen.url,
  };
}

function screenGroupScreen(screen: FoundScreen): TeamIndexScreenGroupScreen {
  return {
    id: screen.nodeId,
    name: screen.name,
    size: screen.size,
    lastModified: screen.lastModified,
    url: screen.url,
  };
}

function screenSizesForUsage(
  usage: FoundComponentUsage,
  groups: readonly TeamIndexScreenGroup[],
): string[] {
  if (!usage.screen.groupId) {
    return [usage.screen.size];
  }

  const group = groups.find(
    (candidate) => candidate.id === usage.screen.groupId,
  );
  return group?.screens.map((screen) => screen.size) ?? [usage.screen.size];
}

function indexComponentUsage(
  usage: FoundComponentUsage,
  groups: readonly TeamIndexScreenGroup[],
): TeamIndexComponentUsage {
  const layoutRisks = layoutRisksForUsage({
    node: usage.node,
    path: usage.instance.path,
    ancestorChain: usage.ancestorChain,
    parentNode: usage.parentNode,
    screenSizes: screenSizesForUsage(usage, groups),
  });

  return {
    componentSet: {
      id: usage.componentSet.id,
      ...(usage.componentSet.key ? { key: usage.componentSet.key } : {}),
      name: usage.componentSet.name,
    },
    screen: indexScreen(usage.screen),
    instance: usage.instance,
    ancestorChain: usage.ancestorChain,
    ...(layoutRisks.length > 0 ? { layoutRisks } : {}),
  };
}

function teamFileSummary(file: DraftFile): TeamIndexFileSummary {
  return {
    key: file.metadata.key,
    name: file.metadata.name,
    lastModified: file.metadata.last_modified,
    projectId: file.metadata.project_id,
    projectName: file.metadata.project_name,
    componentSets: file.componentSets.length,
    components: file.components.length,
    screens: file.screens.length,
  };
}

function fileRef(file: DraftFile): TeamIndexFileRef {
  return {
    key: file.metadata.key,
    name: file.metadata.name,
    lastModified: file.metadata.last_modified,
    projectId: file.metadata.project_id,
    projectName: file.metadata.project_name,
  };
}

function fileIndex(file: DraftFile, threshold: number): TeamIndexFile {
  const groups = assignFileScreenGroups(file, threshold);
  return {
    version: 1,
    kind: "figma-file-index",
    file: fileRef(file),
    componentSets: file.componentSets.map(indexNode),
    components: file.components.map(indexNode),
    screens: file.screens.map(indexScreen),
    screenGroups: groups,
    componentUsages: file.componentUsages.map((usage) =>
      indexComponentUsage(usage, groups),
    ),
  };
}

export function buildTeamIndex(
  options: BuildTeamIndexOptions,
): TeamIndexBundle {
  const threshold =
    options.screenSimilarityThreshold ?? DEFAULT_SCREEN_SIMILARITY_THRESHOLD;
  const sizeTolerance =
    options.screenSizeTolerance ?? DEFAULT_SCREEN_SIZE_TOLERANCE;
  assertTeamIndexOptions(threshold, sizeTolerance);

  const draftFiles = [...options.files]
    .sort((left, right) => {
      return left.metadata.key.localeCompare(right.metadata.key);
    })
    .map((file) => buildDraftFile(file, sizeTolerance));

  return {
    team: {
      version: 1,
      kind: "figma-team-index",
      team: options.teamId,
      files: draftFiles.map(teamFileSummary),
    },
    files: draftFiles.map((file) => fileIndex(file, threshold)),
  };
}
