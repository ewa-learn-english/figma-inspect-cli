import type { ComponentSetLookup } from "../inspect/types.js";
import { CliError } from "./errors.js";
import type { CliCommand, ComponentSetCommandScope } from "./types.js";
import { usage } from "./usage.js";

interface ParsedFlags {
  help: boolean;
  listProjects: boolean;
  listProjectFiles: boolean;
  listPages: boolean;
  listComponentSets: boolean;
  listComponentSetProperties: boolean;
  inspectComponentSet: boolean;
  inspectNode: boolean;
  projectId: string | undefined;
  fileKey: string | undefined;
  nodeId: string | undefined;
  componentSetKey: string | undefined;
  componentSetName: string | undefined;
  json: boolean;
}

function emptyFlags(): ParsedFlags {
  return {
    help: false,
    listProjects: false,
    listProjectFiles: false,
    listPages: false,
    listComponentSets: false,
    listComponentSetProperties: false,
    inspectComponentSet: false,
    inspectNode: false,
    projectId: undefined,
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
    flags.listProjects ? ("list-projects" as const) : undefined,
    flags.listProjectFiles ? ("list-project-files" as const) : undefined,
    flags.listPages ? ("list-pages" as const) : undefined,
    flags.listComponentSets ? ("list-component-sets" as const) : undefined,
    flags.listComponentSetProperties
      ? ("list-component-set-properties" as const)
      : undefined,
    flags.inspectComponentSet ? ("inspect-component-set" as const) : undefined,
    flags.inspectNode ? ("inspect-node" as const) : undefined,
  ].filter((command) => command !== undefined);

  if (selected.length === 0) {
    throw new CliError(
      "Nothing to do. Pass --list-projects, --list-project-files, --list-pages, --list-component-sets, --list-component-set-properties, --inspect-component-set, or --inspect-node.\n\n" +
        usage,
    );
  }

  if (selected.length > 1) {
    throw new CliError("Pass only one command at a time.");
  }

  const command = selected[0];

  switch (command) {
    case "list-projects":
      return { kind: "list-projects", json: flags.json };
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
    case "list-pages":
      return {
        kind: "list-pages",
        fileKey: requireFileKey(flags.fileKey, "--list-pages"),
        json: flags.json,
      };
    case "list-component-sets":
      return {
        kind: "list-component-sets",
        fileKey: requireFileKey(flags.fileKey, "--list-component-sets"),
        nodeId: requireNodeId(flags.nodeId, "--list-component-sets"),
        json: flags.json,
      };
    case "list-component-set-properties":
      return {
        kind: "list-component-set-properties",
        scope: requireComponentSetScope(
          flags,
          "--list-component-set-properties",
        ),
        json: flags.json,
      };
    case "inspect-component-set":
      return {
        kind: "inspect-component-set",
        scope: requireComponentSetScope(flags, "--inspect-component-set"),
      };
    case "inspect-node":
      return {
        kind: "inspect-node",
        fileKey: requireFileKey(flags.fileKey, "--inspect-node"),
        nodeId: requireNodeId(flags.nodeId, "--inspect-node"),
      };
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

    if (arg === "--list-projects") {
      flags.listProjects = true;
      continue;
    }

    if (arg === "--list-project-files") {
      flags.listProjectFiles = true;
      continue;
    }

    if (arg === "--list-pages") {
      flags.listPages = true;
      continue;
    }

    if (arg === "--list-component-sets") {
      flags.listComponentSets = true;
      continue;
    }

    if (arg === "--list-component-set-properties") {
      flags.listComponentSetProperties = true;
      continue;
    }

    if (arg === "--inspect-component-set") {
      flags.inspectComponentSet = true;
      continue;
    }

    if (arg === "--inspect-node") {
      flags.inspectNode = true;
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
