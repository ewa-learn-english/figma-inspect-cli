import {
  FigmaApiError,
  getFileNode,
  listFilePages,
  listProjectFiles,
  listTeamProjects,
} from "./figma-api/index.js";
import type { FigmaFile, FigmaPage, FigmaProject } from "./figma-api/types.js";
import { formatTable, writeJsonOrTable } from "./format-table.js";
import {
  FigmaInspectError,
  getNodeComponentSet,
  listComponentSetProperties,
  listNodeComponentSets,
} from "./inspect/index.js";
import type {
  ComponentSetLookup,
  FigmaComponentSet,
  FigmaComponentSetProperty,
} from "./inspect/types.js";

const usage = `Usage:
  figma-inspect --list-projects [--json]
  figma-inspect --list-project-files --project-id <id> [--json]
  figma-inspect --list-pages --file-key <key> [--json]
  figma-inspect --list-component-sets --file-key <key> --node-id <id> [--json]
  figma-inspect --list-component-set-properties --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>) [--json]
  figma-inspect --inspect-component-set --file-key <key> --node-id <id> (--component-set-key <key> | --component-set-name <name>)
  figma-inspect --inspect-node --file-key <key> --node-id <id>

Environment:
  FIGMA_API_TOKEN  Figma personal access token
  FIGMA_TEAM_ID    Figma team id (required for --list-projects)

Options:
  --list-projects       List projects in a Figma team
  --list-project-files  List files in a Figma project
  --list-pages          List pages in a Figma file
  --list-component-sets   List component sets in a file node
  --list-component-set-properties List nested component sets exposed in a component set
  --inspect-component-set Print raw JSON for a COMPONENT_SET node in a file tree
  --inspect-node          Print raw JSON for a file node
  --project-id <id>       Project id (required with --list-project-files)
  --file-key <key>        File key (required with --list-pages, --list-component-sets, --list-component-set-properties, --inspect-component-set, and --inspect-node)
  --node-id <id>          Node id (required with --list-component-sets, --list-component-set-properties, --inspect-component-set, and --inspect-node)
  --component-set-key <key> Component set key (required with --list-component-set-properties and --inspect-component-set unless --component-set-name is set)
  --component-set-name <n>  Component set name (required with --list-component-set-properties and --inspect-component-set unless --component-set-key is set)
  --json                Print JSON instead of a table
  --help, -h            Show this help message
`;

export interface CliOptions {
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

export interface CliIo {
  env: NodeJS.ProcessEnv;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
}

export async function runCli(argv: string[], io: CliIo): Promise<void> {
  const options = parseArgs(argv);

  if (options.help) {
    io.stdout.write(usage);
    return;
  }

  if (
    !options.listProjects &&
    !options.listProjectFiles &&
    !options.listPages &&
    !options.listComponentSets &&
    !options.listComponentSetProperties &&
    !options.inspectComponentSet &&
    !options.inspectNode
  ) {
    throw new CliError(
      "Nothing to do. Pass --list-projects, --list-project-files, --list-pages, --list-component-sets, --list-component-set-properties, --inspect-component-set, or --inspect-node.\n\n" +
        usage,
    );
  }

  const token = io.env.FIGMA_API_TOKEN;
  if (!token) {
    throw new CliError("Missing FIGMA_API_TOKEN environment variable.");
  }

  try {
    if (options.listProjects) {
      const teamId = io.env.FIGMA_TEAM_ID;
      if (!teamId) {
        throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
      }

      const projects = await listTeamProjects({ token, teamId });
      writeProjects(projects, options.json, io.stdout);
      return;
    }

    if (options.listProjectFiles) {
      if (!options.projectId) {
        throw new CliError("Missing --project-id for --list-project-files.");
      }

      const files = await listProjectFiles({
        token,
        projectId: options.projectId,
      });
      writeFiles(files, options.json, io.stdout);
      return;
    }

    if (options.listComponentSets) {
      if (!options.fileKey) {
        throw new CliError("Missing --file-key for --list-component-sets.");
      }

      if (!options.nodeId) {
        throw new CliError("Missing --node-id for --list-component-sets.");
      }

      const componentSets = await listNodeComponentSets({
        token,
        fileKey: options.fileKey,
        nodeId: options.nodeId,
      });
      writeComponentSets(componentSets, options.json, io.stdout);
      return;
    }

    if (options.listComponentSetProperties) {
      const scope = requireComponentSetScope(
        options,
        "--list-component-set-properties",
      );
      const properties = await listComponentSetProperties({
        token,
        ...scope,
      });
      writeComponentSetProperties(properties, options.json, io.stdout);
      return;
    }

    if (options.inspectComponentSet) {
      const scope = requireComponentSetScope(
        options,
        "--inspect-component-set",
      );
      const componentSet = await getNodeComponentSet({
        token,
        ...scope,
      });
      io.stdout.write(`${JSON.stringify(componentSet, null, 2)}\n`);
      return;
    }

    if (options.inspectNode) {
      if (!options.fileKey) {
        throw new CliError("Missing --file-key for --inspect-node.");
      }

      if (!options.nodeId) {
        throw new CliError("Missing --node-id for --inspect-node.");
      }

      const node = await getFileNode({
        token,
        fileKey: options.fileKey,
        nodeId: options.nodeId,
      });
      io.stdout.write(`${JSON.stringify(node, null, 2)}\n`);
      return;
    }

    if (!options.fileKey) {
      throw new CliError("Missing --file-key for --list-pages.");
    }

    const pages = await listFilePages({
      token,
      fileKey: options.fileKey,
    });
    writePages(pages, options.json, io.stdout);
  } catch (error) {
    if (error instanceof FigmaApiError || error instanceof FigmaInspectError) {
      throw new CliError(error.message);
    }

    throw error;
  }
}

function requireComponentSetScope(
  options: CliOptions,
  command: string,
): {
  fileKey: string;
  nodeId: string;
  componentSet: ComponentSetLookup;
} {
  if (!options.fileKey) {
    throw new CliError(`Missing --file-key for ${command}.`);
  }

  if (!options.nodeId) {
    throw new CliError(`Missing --node-id for ${command}.`);
  }

  return {
    fileKey: options.fileKey,
    nodeId: options.nodeId,
    componentSet: parseComponentSetLookup(
      options.componentSetKey,
      options.componentSetName,
      command,
    ),
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

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
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

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--list-projects") {
      options.listProjects = true;
      continue;
    }

    if (arg === "--list-project-files") {
      options.listProjectFiles = true;
      continue;
    }

    if (arg === "--list-pages") {
      options.listPages = true;
      continue;
    }

    if (arg === "--list-component-sets") {
      options.listComponentSets = true;
      continue;
    }

    if (arg === "--list-component-set-properties") {
      options.listComponentSetProperties = true;
      continue;
    }

    if (arg === "--inspect-component-set") {
      options.inspectComponentSet = true;
      continue;
    }

    if (arg === "--inspect-node") {
      options.inspectNode = true;
      continue;
    }

    if (arg === "--project-id") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new CliError("Missing value for --project-id.");
      }

      options.projectId = value;
      index += 1;
      continue;
    }

    if (arg === "--file-key") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new CliError("Missing value for --file-key.");
      }

      options.fileKey = value;
      index += 1;
      continue;
    }

    if (arg === "--node-id") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new CliError("Missing value for --node-id.");
      }

      options.nodeId = value;
      index += 1;
      continue;
    }

    if (arg === "--component-set-key") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new CliError("Missing value for --component-set-key.");
      }

      options.componentSetKey = value;
      index += 1;
      continue;
    }

    if (arg === "--component-set-name") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new CliError("Missing value for --component-set-name.");
      }

      options.componentSetName = value;
      index += 1;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    throw new CliError(`Unknown option: ${arg}`);
  }

  return options;
}

interface ProjectRow {
  id: string;
  name: string;
  files: string;
}

function writeProjects(
  projects: FigmaProject[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(projects, json, stdout, "No projects found.", (items) => {
    const rows: ProjectRow[] = items.map((project) => ({
      id: String(project.id ?? ""),
      name: String(project.name ?? ""),
      files: project.file_count == null ? "" : String(project.file_count),
    }));
    const showFiles = rows.some((row) => row.files.length > 0);
    const columns = [
      { header: "ID", value: (row: ProjectRow) => row.id },
      { header: "Name", value: (row: ProjectRow) => row.name },
      ...(showFiles
        ? [{ header: "Files", value: (row: ProjectRow) => row.files }]
        : []),
    ];

    return formatTable(columns, rows);
  });
}

interface FileRow {
  key: string;
  name: string;
  modified: string;
}

function writeFiles(
  files: FigmaFile[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(files, json, stdout, "No files found.", (items) => {
    const rows: FileRow[] = items.map((file) => ({
      key: String(file.key ?? ""),
      name: String(file.name ?? ""),
      modified: String(file.last_modified ?? ""),
    }));

    return formatTable(
      [
        { header: "Key", value: (row: FileRow) => row.key },
        { header: "Name", value: (row: FileRow) => row.name },
        { header: "Modified", value: (row: FileRow) => row.modified },
      ],
      rows,
    );
  });
}

function writeComponentSetProperties(
  properties: FigmaComponentSetProperty[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(
    properties,
    json,
    stdout,
    "No component set properties found.",
    (items) =>
      formatTable(
        [
          { header: "ID", value: (property) => property.id },
          { header: "Name", value: (property) => property.name },
          {
            header: "Exposed",
            value: (property) =>
              property.isExposedInstance ? "true" : "false",
          },
        ],
        items,
      ),
  );
}

function writeComponentSets(
  componentSets: FigmaComponentSet[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(
    componentSets,
    json,
    stdout,
    "No component sets found.",
    (items) =>
      formatTable(
        [
          { header: "ID", value: (set) => set.id },
          { header: "Key", value: (set) => set.key },
          { header: "Name", value: (set) => set.name },
        ],
        items,
      ),
  );
}

function writePages(
  pages: FigmaPage[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(pages, json, stdout, "No pages found.", (items) => {
    const rows = items.map((page) => ({
      id: String(page.id ?? ""),
      name: String(page.name ?? ""),
    }));

    return formatTable(
      [
        { header: "ID", value: (row) => row.id },
        { header: "Name", value: (row) => row.name },
      ],
      rows,
    );
  });
}

export class CliError extends Error {}
