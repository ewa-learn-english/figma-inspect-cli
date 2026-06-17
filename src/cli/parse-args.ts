import type { ContractFormat } from "../inspect/contract/contract-format.js";
import { FigmaInspectError, parseFigmaNodeUrl } from "../inspect/index.js";
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
  verifyComponentContract: boolean;
  verifyNodeContract: boolean;
  exportComponentSet: boolean;
  exportNodeContract: boolean;
  exportAssets: boolean;
  assetFormat: "svg" | undefined;
  projectId: string | undefined;
  inputPath: string | undefined;
  outputPath: string | undefined;
  outputDir: string | undefined;
  variablesPath: string | undefined;
  teamComponentsPath: string | undefined;
  url: string | undefined;
  fileKey: string | undefined;
  nodeId: string | undefined;
  componentSetKey: string | undefined;
  componentSetName: string | undefined;
  contractDir: string | undefined;
  componentName: string | undefined;
  nodeName: string | undefined;
  json: boolean;
}

function resolveOutputFormat(flags: ParsedFlags): ContractFormat {
  return flags.json ? "json" : "yaml";
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
    verifyComponentContract: false,
    verifyNodeContract: false,
    exportComponentSet: false,
    exportNodeContract: false,
    exportAssets: false,
    assetFormat: undefined,
    projectId: undefined,
    inputPath: undefined,
    outputPath: undefined,
    outputDir: undefined,
    variablesPath: undefined,
    teamComponentsPath: undefined,
    url: undefined,
    fileKey: undefined,
    nodeId: undefined,
    componentSetKey: undefined,
    componentSetName: undefined,
    contractDir: undefined,
    componentName: undefined,
    nodeName: undefined,
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

function requireVariablesPath(
  variablesPath: string | undefined,
  command: string,
): string {
  if (!variablesPath) {
    throw new CliError(`Missing --variables for ${command}.`);
  }

  return variablesPath;
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
    flags.verifyComponentContract
      ? ("verify-component-contract" as const)
      : undefined,
    flags.verifyNodeContract ? ("verify-node-contract" as const) : undefined,
    flags.exportComponentSet ? ("export-component-set" as const) : undefined,
    flags.exportNodeContract ? ("export-node-contract" as const) : undefined,
  ].filter((command) => command !== undefined);

  if (selected.length === 0) {
    throw new CliError(
      "Nothing to do. Pass --list-team-projects, --list-project-files, --list-team-project-files, --list-team-component-sets, --list-file-pages, --list-file-component-sets, --inspect-component-set-properties, --inspect-component-set, --inspect-team-component-set, --inspect-file-node, --build-component-set-spec, --build-component-set-pseudocode, --verify-component-contract, --verify-node-contract, --export-component-set, or --export-node-contract.\n\n" +
        usage,
    );
  }

  if (selected.length > 1) {
    throw new CliError("Pass only one command at a time.");
  }

  const command = selected[0];

  switch (command) {
    case "list-team-projects":
      return { kind: "list-team-projects", format: resolveOutputFormat(flags) };
    case "list-team-project-files":
      return {
        kind: "list-team-project-files",
        format: resolveOutputFormat(flags),
      };
    case "list-team-component-sets":
      return {
        kind: "list-team-component-sets",
        format: resolveOutputFormat(flags),
      };
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
        variablesPath: requireVariablesPath(
          flags.variablesPath,
          "--build-component-set-spec",
        ),
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
        variablesPath: requireVariablesPath(
          flags.variablesPath,
          "--build-component-set-pseudocode",
        ),
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

      return {
        kind: "export-component-set",
        outputDir: flags.outputDir,
        componentSet: parseComponentSetTarget(flags, "--export-component-set"),
        sourceUrl: flags.url,
        variablesPath: requireVariablesPath(
          flags.variablesPath,
          "--export-component-set",
        ),
        exportAssets: flags.exportAssets,
        assetFormat: flags.assetFormat,
        format: resolveOutputFormat(flags),
      };
    }
    case "export-node-contract": {
      if (!flags.outputDir) {
        throw new CliError("Missing --output-dir for --export-node-contract.");
      }

      const nodeRef = resolveNodeRef(flags, "--export-node-contract");
      return {
        kind: "export-node-contract",
        outputDir: flags.outputDir,
        ...nodeRef,
        sourceUrl: flags.url,
        variablesPath: requireVariablesPath(
          flags.variablesPath,
          "--export-node-contract",
        ),
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

    if (arg === "--verify-component-contract") {
      flags.verifyComponentContract = true;
      continue;
    }

    if (arg === "--verify-node-contract") {
      flags.verifyNodeContract = true;
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

    throw new CliError(`Unknown option: ${arg}`);
  }

  return resolveCommand(flags);
}
