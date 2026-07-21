import type { ContractFormat } from "../inspect/contract/contract-format.js";
import type {
  ExportPreviewOptions,
  NestedAssetFormat,
  NestedAssetNodeType,
  NestedAssetsOptions,
  PreviewFormat,
} from "../inspect/index.js";
import {
  DEFAULT_NESTED_ASSET_SCALE,
  DEFAULT_PREVIEW_SCALE,
  FigmaInspectError,
  isNestedAssetNodeType,
  parseFigmaNodeUrl,
  supportedNestedAssetNodeTypes,
} from "../inspect/index.js";
import type {
  ComponentSetLookup,
  ComponentSetTarget,
  FigmaNodeRef,
} from "../inspect/types.js";
import { CliError } from "./errors.js";
import type { CliCommand, ComponentSetCommandScope } from "./types.js";
import { usage } from "./usage.js";

interface ParsedFlags {
  help: boolean;
  version: boolean;
  listTeamProjects: boolean;
  listProjectFiles: boolean;
  listTeamProjectFiles: boolean;
  exportTeamIndex: boolean;
  refreshIndex: boolean;
  indexStatus: boolean;
  searchComponents: boolean;
  preflight: boolean;
  listTeamComponentSets: boolean;
  listComponentSetUsages: boolean;
  inspectComponentSetResponsiveUsage: boolean;
  listFilePages: boolean;
  listFileComponentSets: boolean;
  inspectComponentSetProperties: boolean;
  inspectComponentSet: boolean;
  inspectTeamComponentSet: boolean;
  inspectFileNode: boolean;
  buildComponentSetSpec: boolean;
  buildComponentSetPseudocode: boolean;
  verifyComponentContract: boolean;
  verifyComponentLock: boolean;
  verifyNodeContract: boolean;
  exportContract: boolean;
  exportComponentSet: boolean;
  exportNodeContract: boolean;
  exportAssets: boolean;
  exportNestedAssets: boolean;
  assetFormats: NestedAssetFormat[];
  assetNodeIds: string[];
  assetIncludeRegex: string | undefined;
  assetNodeTypes: NestedAssetNodeType[] | undefined;
  assetMax: number | undefined;
  assetScale: number | undefined;
  exportPreview: boolean;
  previewFormat: PreviewFormat | undefined;
  previewScale: number | undefined;
  projectId: string | undefined;
  inputPath: string | undefined;
  outputPath: string | undefined;
  outputDir: string | undefined;
  indexDir: string | undefined;
  indexRoot: string | undefined;
  teamAlias: string | undefined;
  nameQuery: string | undefined;
  screenGroup: string | undefined;
  screenSimilarityThreshold: number | undefined;
  screenSizeTolerance: number | undefined;
  variablesPath: string | undefined;
  teamComponentsPath: string | undefined;
  url: string | undefined;
  fileKey: string | undefined;
  nodeId: string | undefined;
  componentSetKey: string | undefined;
  componentSetName: string | undefined;
  contractDir: string | undefined;
  lockFile: string | undefined;
  componentName: string | undefined;
  nodeName: string | undefined;
  full: boolean;
  json: boolean;
}

function resolveOutputFormat(flags: ParsedFlags): ContractFormat {
  return flags.json ? "json" : "yaml";
}

function emptyFlags(): ParsedFlags {
  return {
    help: false,
    version: false,
    listTeamProjects: false,
    listProjectFiles: false,
    listTeamProjectFiles: false,
    exportTeamIndex: false,
    refreshIndex: false,
    indexStatus: false,
    searchComponents: false,
    preflight: false,
    listTeamComponentSets: false,
    listComponentSetUsages: false,
    inspectComponentSetResponsiveUsage: false,
    listFilePages: false,
    listFileComponentSets: false,
    inspectComponentSetProperties: false,
    inspectComponentSet: false,
    inspectTeamComponentSet: false,
    inspectFileNode: false,
    buildComponentSetSpec: false,
    buildComponentSetPseudocode: false,
    verifyComponentContract: false,
    verifyComponentLock: false,
    verifyNodeContract: false,
    exportContract: false,
    exportComponentSet: false,
    exportNodeContract: false,
    exportAssets: false,
    exportNestedAssets: false,
    assetFormats: [],
    assetNodeIds: [],
    assetIncludeRegex: undefined,
    assetNodeTypes: undefined,
    assetMax: undefined,
    assetScale: undefined,
    exportPreview: false,
    previewFormat: undefined,
    previewScale: undefined,
    projectId: undefined,
    inputPath: undefined,
    outputPath: undefined,
    outputDir: undefined,
    indexDir: undefined,
    indexRoot: undefined,
    teamAlias: undefined,
    nameQuery: undefined,
    screenGroup: undefined,
    screenSimilarityThreshold: undefined,
    screenSizeTolerance: undefined,
    variablesPath: undefined,
    teamComponentsPath: undefined,
    url: undefined,
    fileKey: undefined,
    nodeId: undefined,
    componentSetKey: undefined,
    componentSetName: undefined,
    contractDir: undefined,
    lockFile: undefined,
    componentName: undefined,
    nodeName: undefined,
    full: false,
    json: false,
  };
}

function readFlagValue(
  argv: string[],
  index: number,
  flag: string,
): { value: string; nextIndex: number } {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new CliError(`Missing value for ${flag}.`);
  }

  return { value, nextIndex: index + 1 };
}

function parsePreviewFormat(value: string): PreviewFormat {
  if (value === "png" || value === "svg") {
    return value;
  }

  throw new CliError(
    `Unsupported --preview-format ${JSON.stringify(value)}. Expected png or svg.`,
  );
}

function parsePreviewScale(value: string): number {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new CliError(
      `Invalid --preview-scale ${JSON.stringify(value)}. Expected a positive number.`,
    );
  }

  return scale;
}

function parseAssetFormat(value: string): NestedAssetFormat {
  if (value === "svg" || value === "png") {
    return value;
  }

  throw new CliError(
    `Unsupported --asset-format ${JSON.stringify(value)}. Expected svg or png.`,
  );
}

function parseAssetScale(value: string): number {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new CliError(
      `Invalid --asset-scale ${JSON.stringify(value)}. Expected a positive number.`,
    );
  }

  return scale;
}

function parseAssetMax(value: string): number {
  const max = Number(value);
  if (!Number.isInteger(max) || max <= 0) {
    throw new CliError(
      `Invalid --asset-max ${JSON.stringify(value)}. Expected a positive integer.`,
    );
  }

  return max;
}

function parseScreenSimilarityThreshold(value: string): number {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new CliError(
      `Invalid --screen-similarity-threshold ${JSON.stringify(value)}. Expected a number between 0 and 1.`,
    );
  }

  return threshold;
}

function parseScreenSizeTolerance(value: string): number {
  const tolerance = Number(value);
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new CliError(
      `Invalid --screen-size-tolerance ${JSON.stringify(value)}. Expected a non-negative number.`,
    );
  }

  return tolerance;
}

function parseAssetNodeTypes(value: string): NestedAssetNodeType[] {
  const nodeTypes = value
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);

  if (nodeTypes.length === 0) {
    throw new CliError(
      "--asset-node-types must include at least one node type.",
    );
  }

  const supportedTypes = supportedNestedAssetNodeTypes();
  const parsed: NestedAssetNodeType[] = [];
  for (const nodeType of nodeTypes) {
    if (!isNestedAssetNodeType(nodeType)) {
      throw new CliError(
        `Unsupported --asset-node-types entry ${JSON.stringify(nodeType)}. Expected one of ${supportedTypes.join(", ")}.`,
      );
    }
    parsed.push(nodeType);
  }

  return [...new Set(parsed)];
}

function parseAssetIncludeRegex(value: string): string {
  try {
    new RegExp(value, "i");
    return value;
  } catch (error) {
    if (error instanceof Error) {
      throw new CliError(
        `Invalid --asset-include-regex ${JSON.stringify(value)}: ${error.message}`,
      );
    }

    throw error;
  }
}

function normalizeFlagNodeId(value: string): string {
  return value.replace(/-/g, ":");
}

function uniqueAssetFormats(formats: NestedAssetFormat[]): NestedAssetFormat[] {
  return [...new Set(formats)];
}

function resolveAssetFormat(flags: ParsedFlags): "svg" | undefined {
  if (!flags.exportAssets) {
    return undefined;
  }

  const formats = uniqueAssetFormats(flags.assetFormats);
  if (formats.some((format) => format !== "svg")) {
    throw new CliError(
      "--asset-format png is only supported with --export-nested-assets; --export-assets supports svg.",
    );
  }

  return formats.includes("svg") ? "svg" : undefined;
}

function hasNestedAssetFlags(flags: ParsedFlags): boolean {
  return (
    flags.assetNodeIds.length > 0 ||
    flags.assetIncludeRegex !== undefined ||
    flags.assetNodeTypes !== undefined ||
    flags.assetMax !== undefined ||
    flags.assetScale !== undefined
  );
}

function resolveNestedAssetsOptions(
  flags: ParsedFlags,
): NestedAssetsOptions | undefined {
  if (!flags.exportNestedAssets && !hasNestedAssetFlags(flags)) {
    return undefined;
  }

  if (!flags.exportNestedAssets) {
    throw new CliError(
      "--asset-node-id, --asset-include-regex, --asset-node-types, --asset-max, and --asset-scale require --export-nested-assets.",
    );
  }

  if (
    flags.assetNodeIds.length === 0 &&
    flags.assetIncludeRegex === undefined
  ) {
    throw new CliError(
      "--export-nested-assets requires --asset-node-id or --asset-include-regex.",
    );
  }

  const formats = uniqueAssetFormats(
    flags.assetFormats.length > 0 ? flags.assetFormats : ["svg"],
  );
  if (flags.assetScale !== undefined && !formats.includes("png")) {
    throw new CliError(
      "--asset-scale is only supported with --asset-format png.",
    );
  }

  return {
    nodeIds: flags.assetNodeIds,
    ...(flags.assetIncludeRegex
      ? { includeRegex: flags.assetIncludeRegex }
      : {}),
    ...(flags.assetNodeTypes ? { nodeTypes: flags.assetNodeTypes } : {}),
    ...(flags.assetMax !== undefined ? { maxAssets: flags.assetMax } : {}),
    formats,
    scale: flags.assetScale ?? DEFAULT_NESTED_ASSET_SCALE,
  };
}

function rejectUnusedAssetFormats(flags: ParsedFlags): void {
  if (
    flags.assetFormats.length > 0 &&
    !flags.exportAssets &&
    !flags.exportNestedAssets
  ) {
    throw new CliError(
      "--asset-format requires --export-assets or --export-nested-assets.",
    );
  }
}

function resolvePreviewOptions(
  flags: ParsedFlags,
): ExportPreviewOptions | undefined {
  if (
    !flags.exportPreview &&
    flags.previewFormat === undefined &&
    flags.previewScale === undefined
  ) {
    return undefined;
  }

  if (!flags.exportPreview) {
    throw new CliError(
      "--preview-format and --preview-scale require --export-preview.",
    );
  }

  const format = flags.previewFormat ?? "png";
  if (format === "svg") {
    if (flags.previewScale !== undefined) {
      throw new CliError(
        "--preview-scale is only supported with --preview-format png.",
      );
    }

    return { format };
  }

  return {
    format,
    scale: flags.previewScale ?? DEFAULT_PREVIEW_SCALE,
  };
}

function parseComponentSetLookup(
  componentSetKey: string | undefined,
  componentSetName: string | undefined,
  command: string,
): ComponentSetLookup {
  if (componentSetKey && componentSetName) {
    throw new CliError(
      `Pass either --component-set-key or --component-set-name for ${command}.`,
    );
  }

  if (componentSetKey) {
    return { kind: "key", value: componentSetKey };
  }

  if (componentSetName) {
    return { kind: "name", value: componentSetName };
  }

  throw new CliError(
    `Missing --component-set-key or --component-set-name for ${command}.`,
  );
}

function requireFileKey(fileKey: string | undefined, command: string): string {
  if (!fileKey) {
    throw new CliError(`Missing --file-key for ${command}.`);
  }

  return fileKey;
}

function requireNodeId(nodeId: string | undefined, command: string): string {
  if (!nodeId) {
    throw new CliError(`Missing --node-id for ${command}.`);
  }

  return nodeId;
}

function requireComponentSetScope(
  flags: ParsedFlags,
  command: string,
): ComponentSetCommandScope {
  if (flags.url) {
    rejectFileNodeFlagsWithUrl(flags, command);
    rejectComponentSetLookupWithUrl(flags, command);
    return { kind: "node", ...parseFigmaUrl(flags.url) };
  }

  return {
    kind: "lookup",
    fileKey: requireFileKey(flags.fileKey, command),
    nodeId: requireNodeId(flags.nodeId, command),
    componentSet: parseComponentSetLookup(
      flags.componentSetKey,
      flags.componentSetName,
      command,
    ),
  };
}

function parseFigmaUrl(url: string): FigmaNodeRef {
  try {
    return parseFigmaNodeUrl(url);
  } catch (error) {
    if (error instanceof FigmaInspectError) {
      throw new CliError(error.message);
    }

    throw error;
  }
}

function rejectFileNodeFlagsWithUrl(flags: ParsedFlags, command: string): void {
  if (flags.fileKey || flags.nodeId) {
    throw new CliError(
      `Pass either --url or --file-key/--node-id for ${command}.`,
    );
  }
}

function rejectComponentSetLookupWithUrl(
  flags: ParsedFlags,
  command: string,
): void {
  if (flags.componentSetKey || flags.componentSetName) {
    throw new CliError(
      `Pass either --url or --component-set-key/--component-set-name for ${command}.`,
    );
  }
}

function resolveNodeRef(flags: ParsedFlags, command: string): FigmaNodeRef {
  if (flags.url) {
    rejectFileNodeFlagsWithUrl(flags, command);
    return parseFigmaUrl(flags.url);
  }

  return {
    fileKey: requireFileKey(flags.fileKey, command),
    nodeId: requireNodeId(flags.nodeId, command),
  };
}

function parseComponentSetTarget(
  flags: ParsedFlags,
  command: string,
): ComponentSetTarget {
  if (flags.url) {
    rejectFileNodeFlagsWithUrl(flags, command);
    rejectComponentSetLookupWithUrl(flags, command);
    return { kind: "node", ...parseFigmaUrl(flags.url) };
  }

  return parseComponentSetLookup(
    flags.componentSetKey,
    flags.componentSetName,
    command,
  );
}

function resolveCommand(flags: ParsedFlags): CliCommand {
  if (flags.help) {
    return { kind: "help" };
  }

  const selected = [
    flags.version ? ("version" as const) : undefined,
    flags.listTeamProjects ? ("list-team-projects" as const) : undefined,
    flags.listProjectFiles ? ("list-project-files" as const) : undefined,
    flags.listTeamProjectFiles
      ? ("list-team-project-files" as const)
      : undefined,
    flags.exportTeamIndex ? ("export-team-index" as const) : undefined,
    flags.refreshIndex ? ("refresh-index" as const) : undefined,
    flags.indexStatus ? ("index-status" as const) : undefined,
    flags.searchComponents ? ("search-components" as const) : undefined,
    flags.preflight ? ("preflight" as const) : undefined,
    flags.listTeamComponentSets
      ? ("list-team-component-sets" as const)
      : undefined,
    flags.listComponentSetUsages
      ? ("list-component-set-usages" as const)
      : undefined,
    flags.inspectComponentSetResponsiveUsage
      ? ("inspect-component-set-responsive-usage" as const)
      : undefined,
    flags.listFilePages ? ("list-file-pages" as const) : undefined,
    flags.listFileComponentSets
      ? ("list-file-component-sets" as const)
      : undefined,
    flags.inspectComponentSetProperties
      ? ("inspect-component-set-properties" as const)
      : undefined,
    flags.inspectComponentSet ? ("inspect-component-set" as const) : undefined,
    flags.inspectTeamComponentSet
      ? ("inspect-team-component-set" as const)
      : undefined,
    flags.inspectFileNode ? ("inspect-file-node" as const) : undefined,
    flags.buildComponentSetSpec
      ? ("build-component-set-spec" as const)
      : undefined,
    flags.buildComponentSetPseudocode
      ? ("build-component-set-pseudocode" as const)
      : undefined,
    flags.verifyComponentContract
      ? ("verify-component-contract" as const)
      : undefined,
    flags.verifyComponentLock ? ("verify-component-lock" as const) : undefined,
    flags.verifyNodeContract ? ("verify-node-contract" as const) : undefined,
    flags.exportContract ? ("export-contract" as const) : undefined,
    flags.exportComponentSet ? ("export-component-set" as const) : undefined,
    flags.exportNodeContract ? ("export-node-contract" as const) : undefined,
  ].filter((command) => command !== undefined);

  if (selected.length === 0) {
    throw new CliError(
      "Nothing to do. Pass --version, --list-team-projects, --list-project-files, --list-team-project-files, --export-team-index, --refresh-index, --index-status, --search-components, --preflight, --list-team-component-sets, --list-component-set-usages, --inspect-component-set-responsive-usage, --list-file-pages, --list-file-component-sets, --inspect-component-set-properties, --inspect-component-set, --inspect-team-component-set, --inspect-file-node, --build-component-set-spec, --build-component-set-pseudocode, --verify-component-contract, --verify-component-lock, --verify-node-contract, --export-contract, --export-component-set, or --export-node-contract.\n\n" +
        usage,
    );
  }

  if (selected.length > 1) {
    throw new CliError("Pass only one command at a time.");
  }

  const command = selected[0];
  if (
    command !== "export-team-index" &&
    command !== "refresh-index" &&
    (flags.screenSimilarityThreshold !== undefined ||
      flags.screenSizeTolerance !== undefined)
  ) {
    throw new CliError(
      "--screen-similarity-threshold and --screen-size-tolerance require --export-team-index or --refresh-index.",
    );
  }

  if (
    command !== "list-component-set-usages" &&
    command !== "inspect-component-set-responsive-usage" &&
    (flags.indexDir !== undefined ||
      flags.screenGroup !== undefined ||
      flags.full)
  ) {
    throw new CliError(
      "--index-dir, --screen-group, and --full require --list-component-set-usages or --inspect-component-set-responsive-usage.",
    );
  }

  if (command !== "verify-component-lock" && flags.lockFile !== undefined) {
    throw new CliError("--lock-file requires --verify-component-lock.");
  }

  const teamCommands = new Set([
    "list-team-projects",
    "list-team-project-files",
    "export-team-index",
    "refresh-index",
    "index-status",
    "search-components",
    "preflight",
    "list-team-component-sets",
    "inspect-team-component-set",
    "export-component-set",
    "export-contract",
  ]);
  if (!teamCommands.has(command) && flags.teamAlias !== undefined) {
    throw new CliError("--team is not supported with this command.");
  }

  const managedIndexCommands = new Set([
    "refresh-index",
    "index-status",
    "search-components",
    "preflight",
  ]);
  if (!managedIndexCommands.has(command) && flags.indexRoot !== undefined) {
    throw new CliError("--index-root requires a managed index command.");
  }

  if (command !== "search-components" && flags.nameQuery !== undefined) {
    throw new CliError("--name requires --search-components.");
  }

  switch (command) {
    case "version":
      return { kind: "version" };
    case "list-team-projects":
      return {
        kind: "list-team-projects",
        teamAlias: flags.teamAlias,
        format: resolveOutputFormat(flags),
      };
    case "list-team-project-files":
      return {
        kind: "list-team-project-files",
        teamAlias: flags.teamAlias,
        format: resolveOutputFormat(flags),
      };
    case "export-team-index": {
      if (!flags.outputDir) {
        throw new CliError("Missing --output-dir for --export-team-index.");
      }

      if (flags.json) {
        throw new CliError(
          "--json is not supported with --export-team-index; team index files are SQLite.",
        );
      }

      return {
        kind: "export-team-index",
        outputDir: flags.outputDir,
        teamAlias: flags.teamAlias,
        screenSimilarityThreshold: flags.screenSimilarityThreshold,
        screenSizeTolerance: flags.screenSizeTolerance,
      };
    }
    case "refresh-index":
      return {
        kind: "refresh-index",
        teamAlias: flags.teamAlias,
        indexRoot: flags.indexRoot,
        screenSimilarityThreshold: flags.screenSimilarityThreshold,
        screenSizeTolerance: flags.screenSizeTolerance,
        format: resolveOutputFormat(flags),
      };
    case "index-status":
      return {
        kind: "index-status",
        teamAlias: flags.teamAlias,
        indexRoot: flags.indexRoot,
        format: resolveOutputFormat(flags),
      };
    case "search-components": {
      if (!flags.nameQuery) {
        throw new CliError("Missing --name for --search-components.");
      }
      return {
        kind: "search-components",
        query: flags.nameQuery,
        teamAlias: flags.teamAlias,
        indexRoot: flags.indexRoot,
        format: resolveOutputFormat(flags),
      };
    }
    case "preflight":
      return {
        kind: "preflight",
        teamAlias: flags.teamAlias,
        indexRoot: flags.indexRoot,
        format: resolveOutputFormat(flags),
      };
    case "list-team-component-sets":
      return {
        kind: "list-team-component-sets",
        teamAlias: flags.teamAlias,
        format: resolveOutputFormat(flags),
      };
    case "list-component-set-usages": {
      if (!flags.indexDir) {
        throw new CliError(
          "Missing --index-dir for --list-component-set-usages.",
        );
      }

      return {
        kind: "list-component-set-usages",
        indexDir: flags.indexDir,
        componentSet: parseComponentSetLookup(
          flags.componentSetKey,
          flags.componentSetName,
          "--list-component-set-usages",
        ),
        screenGroup: flags.screenGroup,
        ...(flags.full ? { full: true } : {}),
        format: resolveOutputFormat(flags),
      };
    }
    case "inspect-component-set-responsive-usage": {
      if (!flags.indexDir) {
        throw new CliError(
          "Missing --index-dir for --inspect-component-set-responsive-usage.",
        );
      }

      return {
        kind: "inspect-component-set-responsive-usage",
        indexDir: flags.indexDir,
        componentSet: parseComponentSetLookup(
          flags.componentSetKey,
          flags.componentSetName,
          "--inspect-component-set-responsive-usage",
        ),
        screenGroup: flags.screenGroup,
        ...(flags.full ? { full: true } : {}),
        format: resolveOutputFormat(flags),
      };
    }
    case "list-project-files": {
      if (!flags.projectId) {
        throw new CliError("Missing --project-id for --list-project-files.");
      }

      return {
        kind: "list-project-files",
        projectId: flags.projectId,
        format: resolveOutputFormat(flags),
      };
    }
    case "list-file-pages":
      return {
        kind: "list-file-pages",
        fileKey: requireFileKey(flags.fileKey, "--list-file-pages"),
        format: resolveOutputFormat(flags),
      };
    case "list-file-component-sets":
      return {
        kind: "list-file-component-sets",
        fileKey: requireFileKey(flags.fileKey, "--list-file-component-sets"),
        format: resolveOutputFormat(flags),
      };
    case "inspect-component-set-properties":
      return {
        kind: "inspect-component-set-properties",
        scope: requireComponentSetScope(
          flags,
          "--inspect-component-set-properties",
        ),
        format: resolveOutputFormat(flags),
      };
    case "inspect-component-set":
      return {
        kind: "inspect-component-set",
        scope: requireComponentSetScope(flags, "--inspect-component-set"),
        format: resolveOutputFormat(flags),
      };
    case "inspect-team-component-set":
      return {
        kind: "inspect-team-component-set",
        componentSet: parseComponentSetLookup(
          flags.componentSetKey,
          flags.componentSetName,
          "--inspect-team-component-set",
        ),
        teamAlias: flags.teamAlias,
        format: resolveOutputFormat(flags),
      };
    case "inspect-file-node":
      return {
        kind: "inspect-file-node",
        ...resolveNodeRef(flags, "--inspect-file-node"),
        sourceUrl: flags.url,
        format: resolveOutputFormat(flags),
      };
    case "build-component-set-spec": {
      if (!flags.inputPath) {
        throw new CliError("Missing --input for --build-component-set-spec.");
      }

      return {
        kind: "build-component-set-spec",
        inputPath: flags.inputPath,
        variablesPath: flags.variablesPath,
        teamComponentsPath: flags.teamComponentsPath,
        format: resolveOutputFormat(flags),
      };
    }
    case "build-component-set-pseudocode": {
      if (!flags.inputPath) {
        throw new CliError(
          "Missing --input for --build-component-set-pseudocode.",
        );
      }

      return {
        kind: "build-component-set-pseudocode",
        inputPath: flags.inputPath,
        outputDir: flags.outputDir ?? flags.outputPath,
        variablesPath: flags.variablesPath,
        teamComponentsPath: flags.teamComponentsPath,
        format: resolveOutputFormat(flags),
      };
    }
    case "verify-component-contract": {
      if (!flags.contractDir) {
        throw new CliError(
          "Missing --contract-dir for --verify-component-contract.",
        );
      }

      return {
        kind: "verify-component-contract",
        contractDir: flags.contractDir,
        componentName: flags.componentName,
        outputFormat: resolveOutputFormat(flags),
      };
    }
    case "verify-component-lock": {
      if (!flags.lockFile) {
        throw new CliError("Missing --lock-file for --verify-component-lock.");
      }

      return {
        kind: "verify-component-lock",
        lockFile: flags.lockFile,
        outputFormat: resolveOutputFormat(flags),
      };
    }
    case "verify-node-contract": {
      if (!flags.contractDir) {
        throw new CliError(
          "Missing --contract-dir for --verify-node-contract.",
        );
      }

      return {
        kind: "verify-node-contract",
        contractDir: flags.contractDir,
        nodeName: flags.nodeName,
        outputFormat: resolveOutputFormat(flags),
      };
    }
    case "export-component-set": {
      if (!flags.outputDir) {
        throw new CliError("Missing --output-dir for --export-component-set.");
      }

      rejectUnusedAssetFormats(flags);
      const preview = resolvePreviewOptions(flags);
      const assetFormat = resolveAssetFormat(flags);
      const nestedAssets = resolveNestedAssetsOptions(flags);
      return {
        kind: "export-component-set",
        outputDir: flags.outputDir,
        componentSet: parseComponentSetTarget(flags, "--export-component-set"),
        teamAlias: flags.teamAlias,
        sourceUrl: flags.url,
        variablesPath: flags.variablesPath,
        exportAssets: flags.exportAssets,
        assetFormat,
        ...(nestedAssets ? { nestedAssets } : {}),
        ...(preview ? { preview } : {}),
        format: resolveOutputFormat(flags),
      };
    }
    case "export-contract": {
      if (!flags.outputDir) {
        throw new CliError("Missing --output-dir for --export-contract.");
      }

      const nodeRef = resolveNodeRef(flags, "--export-contract");
      rejectUnusedAssetFormats(flags);
      const preview = resolvePreviewOptions(flags);
      const assetFormat = resolveAssetFormat(flags);
      const nestedAssets = resolveNestedAssetsOptions(flags);
      return {
        kind: "export-contract",
        outputDir: flags.outputDir,
        ...nodeRef,
        teamAlias: flags.teamAlias,
        sourceUrl: flags.url,
        variablesPath: flags.variablesPath,
        exportAssets: flags.exportAssets,
        assetFormat,
        ...(nestedAssets ? { nestedAssets } : {}),
        ...(preview ? { preview } : {}),
        format: resolveOutputFormat(flags),
      };
    }
    case "export-node-contract": {
      if (!flags.outputDir) {
        throw new CliError("Missing --output-dir for --export-node-contract.");
      }

      const nodeRef = resolveNodeRef(flags, "--export-node-contract");
      if (flags.exportAssets) {
        throw new CliError(
          "--export-assets is not supported with --export-node-contract. Use --export-nested-assets for node sidecar assets.",
        );
      }
      rejectUnusedAssetFormats(flags);
      const preview = resolvePreviewOptions(flags);
      const nestedAssets = resolveNestedAssetsOptions(flags);
      return {
        kind: "export-node-contract",
        outputDir: flags.outputDir,
        ...nodeRef,
        sourceUrl: flags.url,
        variablesPath: flags.variablesPath,
        ...(nestedAssets ? { nestedAssets } : {}),
        ...(preview ? { preview } : {}),
        format: resolveOutputFormat(flags),
      };
    }
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}

export function parseCommand(argv: string[]): CliCommand {
  const flags = emptyFlags();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      flags.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      flags.version = true;
      continue;
    }

    if (arg === "--list-team-projects") {
      flags.listTeamProjects = true;
      continue;
    }

    if (arg === "--list-project-files") {
      flags.listProjectFiles = true;
      continue;
    }

    if (arg === "--list-team-project-files") {
      flags.listTeamProjectFiles = true;
      continue;
    }

    if (arg === "--export-team-index") {
      flags.exportTeamIndex = true;
      continue;
    }

    if (arg === "--refresh-index") {
      flags.refreshIndex = true;
      continue;
    }

    if (arg === "--index-status") {
      flags.indexStatus = true;
      continue;
    }

    if (arg === "--search-components") {
      flags.searchComponents = true;
      continue;
    }

    if (arg === "--preflight") {
      flags.preflight = true;
      continue;
    }

    if (arg === "--list-team-component-sets") {
      flags.listTeamComponentSets = true;
      continue;
    }

    if (arg === "--list-component-set-usages") {
      flags.listComponentSetUsages = true;
      continue;
    }

    if (arg === "--inspect-component-set-responsive-usage") {
      flags.inspectComponentSetResponsiveUsage = true;
      continue;
    }

    if (arg === "--list-file-pages") {
      flags.listFilePages = true;
      continue;
    }

    if (arg === "--list-file-component-sets") {
      flags.listFileComponentSets = true;
      continue;
    }

    if (arg === "--inspect-component-set-properties") {
      flags.inspectComponentSetProperties = true;
      continue;
    }

    if (arg === "--inspect-component-set") {
      flags.inspectComponentSet = true;
      continue;
    }

    if (arg === "--inspect-team-component-set") {
      flags.inspectTeamComponentSet = true;
      continue;
    }

    if (arg === "--inspect-file-node") {
      flags.inspectFileNode = true;
      continue;
    }

    if (arg === "--build-component-set-spec") {
      flags.buildComponentSetSpec = true;
      continue;
    }

    if (arg === "--build-component-set-pseudocode") {
      flags.buildComponentSetPseudocode = true;
      continue;
    }

    if (arg === "--verify-component-contract") {
      flags.verifyComponentContract = true;
      continue;
    }

    if (arg === "--verify-component-lock") {
      flags.verifyComponentLock = true;
      continue;
    }

    if (arg === "--verify-node-contract") {
      flags.verifyNodeContract = true;
      continue;
    }

    if (arg === "--export-contract") {
      flags.exportContract = true;
      continue;
    }

    if (arg === "--export-component-set") {
      flags.exportComponentSet = true;
      continue;
    }

    if (arg === "--export-node-contract") {
      flags.exportNodeContract = true;
      continue;
    }

    if (arg === "--export-assets") {
      flags.exportAssets = true;
      continue;
    }

    if (arg === "--export-nested-assets") {
      flags.exportNestedAssets = true;
      continue;
    }

    if (arg === "--export-preview") {
      flags.exportPreview = true;
      continue;
    }

    if (arg === "--asset-format") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.assetFormats.push(parseAssetFormat(value));
      index = nextIndex;
      continue;
    }

    if (arg === "--asset-node-id") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.assetNodeIds.push(normalizeFlagNodeId(value));
      index = nextIndex;
      continue;
    }

    if (arg === "--asset-include-regex") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.assetIncludeRegex = parseAssetIncludeRegex(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--asset-node-types") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.assetNodeTypes = parseAssetNodeTypes(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--asset-max") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.assetMax = parseAssetMax(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--asset-scale") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.assetScale = parseAssetScale(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--preview-format") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.previewFormat = parsePreviewFormat(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--preview-scale") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.previewScale = parsePreviewScale(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--screen-similarity-threshold") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.screenSimilarityThreshold = parseScreenSimilarityThreshold(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--screen-size-tolerance") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.screenSizeTolerance = parseScreenSizeTolerance(value);
      index = nextIndex;
      continue;
    }

    if (arg === "--index-dir") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.indexDir = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--index-root") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.indexRoot = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--team") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.teamAlias = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--name") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.nameQuery = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--screen-group") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.screenGroup = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--input") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.inputPath = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--variables") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.variablesPath = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--team-components") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.teamComponentsPath = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--url") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.url = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--output") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.outputPath = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--output-dir") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.outputDir = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--project-id") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.projectId = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--file-key") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.fileKey = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--node-id") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.nodeId = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--component-set-key") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.componentSetKey = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--component-set-name") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.componentSetName = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--contract-dir") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.contractDir = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--lock-file") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.lockFile = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--component-name") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.componentName = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--node-name") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      flags.nodeName = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--json") {
      flags.json = true;
      continue;
    }

    if (arg === "--full") {
      flags.full = true;
      continue;
    }

    throw new CliError(`Unknown option: ${arg}`);
  }

  return resolveCommand(flags);
}
