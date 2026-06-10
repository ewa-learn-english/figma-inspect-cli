import type { ComponentSetLookup } from "../inspect/types.js";
import { CliError } from "./errors.js";
import type { CliCommand, ComponentSetCommandScope } from "./types.js";
import { usage } from "./usage.js";

interface ParsedFlags {
  help: boolean;
  listTeamProjects: boolean;
  listProjectFiles: boolean;
  listTeamProjectFiles: boolean;
  listTeamComponentSets: boolean;
  listFilePages: boolean;
  listFileComponentSets: boolean;
  inspectComponentSetProperties: boolean;
  inspectComponentSet: boolean;
  inspectTeamComponentSet: boolean;
  inspectFileNode: boolean;
  buildComponentSetSpec: boolean;
  buildComponentSetPseudocode: boolean;
  exportComponentSet: boolean;
  exportAssets: boolean;
  assetFormat: "svg" | undefined;
  projectId: string | undefined;
  inputPath: string | undefined;
  outputPath: string | undefined;
  outputDir: string | undefined;
  variablesPath: string | undefined;
  teamComponentsPath: string | undefined;
  fileKey: string | undefined;
  nodeId: string | undefined;
  componentSetKey: string | undefined;
  componentSetName: string | undefined;
  json: boolean;
}

function emptyFlags(): ParsedFlags {
  return {
    help: false,
    listTeamProjects: false,
    listProjectFiles: false,
    listTeamProjectFiles: false,
    listTeamComponentSets: false,
    listFilePages: false,
    listFileComponentSets: false,
    inspectComponentSetProperties: false,
    inspectComponentSet: false,
    inspectTeamComponentSet: false,
    inspectFileNode: false,
    buildComponentSetSpec: false,
    buildComponentSetPseudocode: false,
    exportComponentSet: false,
    exportAssets: false,
    assetFormat: undefined,
    projectId: undefined,
    inputPath: undefined,
    outputPath: undefined,
    outputDir: undefined,
    variablesPath: undefined,
    teamComponentsPath: undefined,
    fileKey: undefined,
    nodeId: undefined,
    componentSetKey: undefined,
    componentSetName: undefined,
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
  return {
    fileKey: requireFileKey(flags.fileKey, command),
    nodeId: requireNodeId(flags.nodeId, command),
    componentSet: parseComponentSetLookup(
      flags.componentSetKey,
      flags.componentSetName,
      command,
    ),
  };
}

function resolveCommand(flags: ParsedFlags): CliCommand {
  if (flags.help) {
    return { kind: "help" };
  }

  const selected = [
    flags.listTeamProjects ? ("list-team-projects" as const) : undefined,
    flags.listProjectFiles ? ("list-project-files" as const) : undefined,
    flags.listTeamProjectFiles
      ? ("list-team-project-files" as const)
      : undefined,
    flags.listTeamComponentSets
      ? ("list-team-component-sets" as const)
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
    flags.exportComponentSet ? ("export-component-set" as const) : undefined,
  ].filter((command) => command !== undefined);

  if (selected.length === 0) {
    throw new CliError(
      "Nothing to do. Pass --list-team-projects, --list-project-files, --list-team-project-files, --list-team-component-sets, --list-file-pages, --list-file-component-sets, --inspect-component-set-properties, --inspect-component-set, --inspect-team-component-set, --inspect-file-node, --build-component-set-spec, --build-component-set-pseudocode, or --export-component-set.\n\n" +
        usage,
    );
  }

  if (selected.length > 1) {
    throw new CliError("Pass only one command at a time.");
  }

  const command = selected[0];

  switch (command) {
    case "list-team-projects":
      return { kind: "list-team-projects", json: flags.json };
    case "list-team-project-files":
      return { kind: "list-team-project-files", json: flags.json };
    case "list-team-component-sets":
      return { kind: "list-team-component-sets", json: flags.json };
    case "list-project-files": {
      if (!flags.projectId) {
        throw new CliError("Missing --project-id for --list-project-files.");
      }

      return {
        kind: "list-project-files",
        projectId: flags.projectId,
        json: flags.json,
      };
    }
    case "list-file-pages":
      return {
        kind: "list-file-pages",
        fileKey: requireFileKey(flags.fileKey, "--list-file-pages"),
        json: flags.json,
      };
    case "list-file-component-sets":
      return {
        kind: "list-file-component-sets",
        fileKey: requireFileKey(flags.fileKey, "--list-file-component-sets"),
        json: flags.json,
      };
    case "inspect-component-set-properties":
      return {
        kind: "inspect-component-set-properties",
        scope: requireComponentSetScope(
          flags,
          "--inspect-component-set-properties",
        ),
        json: flags.json,
      };
    case "inspect-component-set":
      return {
        kind: "inspect-component-set",
        scope: requireComponentSetScope(flags, "--inspect-component-set"),
      };
    case "inspect-team-component-set":
      return {
        kind: "inspect-team-component-set",
        componentSet: parseComponentSetLookup(
          flags.componentSetKey,
          flags.componentSetName,
          "--inspect-team-component-set",
        ),
      };
    case "inspect-file-node":
      return {
        kind: "inspect-file-node",
        fileKey: requireFileKey(flags.fileKey, "--inspect-file-node"),
        nodeId: requireNodeId(flags.nodeId, "--inspect-file-node"),
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
      };
    }
    case "export-component-set": {
      if (!flags.outputDir) {
        throw new CliError("Missing --output-dir for --export-component-set.");
      }

      return {
        kind: "export-component-set",
        outputDir: flags.outputDir,
        componentSet: parseComponentSetLookup(
          flags.componentSetKey,
          flags.componentSetName,
          "--export-component-set",
        ),
        variablesPath: flags.variablesPath,
        exportAssets: flags.exportAssets,
        assetFormat: flags.assetFormat,
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

    if (arg === "--list-team-component-sets") {
      flags.listTeamComponentSets = true;
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

    if (arg === "--export-component-set") {
      flags.exportComponentSet = true;
      continue;
    }

    if (arg === "--export-assets") {
      flags.exportAssets = true;
      continue;
    }

    if (arg === "--asset-format") {
      const { value, nextIndex } = readFlagValue(argv, index, arg);
      if (value !== "svg") {
        throw new CliError(
          `Unsupported --asset-format ${JSON.stringify(value)}. Expected svg.`,
        );
      }
      flags.assetFormat = value;
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

    if (arg === "--json") {
      flags.json = true;
      continue;
    }

    throw new CliError(`Unknown option: ${arg}`);
  }

  return resolveCommand(flags);
}
