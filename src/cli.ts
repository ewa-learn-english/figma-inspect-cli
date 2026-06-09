import {
  FigmaApiError,
  getFileNode,
  getNodeComponentSet,
  listComponentSetProperties,
  listFilePages,
  listNodeComponentSets,
  listProjectFiles,
  listTeamProjects,
} from "./figma-api/index.js";
import type {
  FigmaComponentSet,
  FigmaComponentSetProperty,
  FigmaFile,
  FigmaPage,
  FigmaProject,
} from "./figma-api/types.js";

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
      writeProjects(projects, options, io.stdout);
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
      writeFiles(files, options, io.stdout);
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
      writeComponentSets(componentSets, options, io.stdout);
      return;
    }

    if (options.listComponentSetProperties) {
      if (!options.fileKey) {
        throw new CliError(
          "Missing --file-key for --list-component-set-properties.",
        );
      }

      if (!options.nodeId) {
        throw new CliError(
          "Missing --node-id for --list-component-set-properties.",
        );
      }

      if (options.componentSetKey && options.componentSetName) {
        throw new CliError(
          "Pass either --component-set-key or --component-set-name for --list-component-set-properties.",
        );
      }

      if (!options.componentSetKey && !options.componentSetName) {
        throw new CliError(
          "Missing --component-set-key or --component-set-name for --list-component-set-properties.",
        );
      }

      try {
        const properties = await listComponentSetProperties({
          token,
          fileKey: options.fileKey,
          nodeId: options.nodeId,
          componentSetKey: options.componentSetKey,
          componentSetName: options.componentSetName,
        });
        writeComponentSetProperties(properties, options, io.stdout);
      } catch (error) {
        if (error instanceof Error) {
          throw new CliError(error.message);
        }

        throw error;
      }
      return;
    }

    if (options.inspectComponentSet) {
      if (!options.fileKey) {
        throw new CliError("Missing --file-key for --inspect-component-set.");
      }

      if (!options.nodeId) {
        throw new CliError("Missing --node-id for --inspect-component-set.");
      }

      if (options.componentSetKey && options.componentSetName) {
        throw new CliError(
          "Pass either --component-set-key or --component-set-name for --inspect-component-set.",
        );
      }

      if (!options.componentSetKey && !options.componentSetName) {
        throw new CliError(
          "Missing --component-set-key or --component-set-name for --inspect-component-set.",
        );
      }

      try {
        const componentSet = await getNodeComponentSet({
          token,
          fileKey: options.fileKey,
          nodeId: options.nodeId,
          componentSetKey: options.componentSetKey,
          componentSetName: options.componentSetName,
        });
        io.stdout.write(`${JSON.stringify(componentSet, null, 2)}\n`);
      } catch (error) {
        if (error instanceof Error) {
          throw new CliError(error.message);
        }

        throw error;
      }
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
    writePages(pages, options, io.stdout);
  } catch (error) {
    if (error instanceof FigmaApiError) {
      throw new CliError(error.message);
    }

    throw error;
  }
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
  options: CliOptions,
  stdout: NodeJS.WriteStream,
): void {
  if (options.json) {
    stdout.write(`${JSON.stringify(projects, null, 2)}\n`);
    return;
  }

  if (projects.length === 0) {
    stdout.write("No projects found.\n");
    return;
  }

  const rows: ProjectRow[] = projects.map((project) => ({
    id: String(project.id ?? ""),
    name: String(project.name ?? ""),
    files: project.file_count == null ? "" : String(project.file_count),
  }));
  const showFiles = rows.some((row) => row.files.length > 0);

  const widths: { id: number; name: number; files?: number } = {
    id: Math.max("ID".length, ...rows.map((row) => row.id.length)),
    name: Math.max("Name".length, ...rows.map((row) => row.name.length)),
  };

  if (showFiles) {
    widths.files = Math.max(
      "Files".length,
      ...rows.map((row) => row.files.length),
    );
  }

  const header = showFiles
    ? `${pad("ID", widths.id)}  ${pad("Name", widths.name)}  ${pad("Files", widths.files!)}`
    : `${pad("ID", widths.id)}  ${pad("Name", widths.name)}`;
  const divider = showFiles
    ? `${"-".repeat(widths.id)}  ${"-".repeat(widths.name)}  ${"-".repeat(widths.files!)}`
    : `${"-".repeat(widths.id)}  ${"-".repeat(widths.name)}`;

  stdout.write(
    `${[
      header,
      divider,
      ...rows.map((row) => {
        const base = `${pad(row.id, widths.id)}  ${pad(row.name, widths.name)}`;
        return showFiles ? `${base}  ${pad(row.files, widths.files!)}` : base;
      }),
    ].join("\n")}\n`,
  );
}

interface FileRow {
  key: string;
  name: string;
  modified: string;
}

function writeFiles(
  files: FigmaFile[],
  options: CliOptions,
  stdout: NodeJS.WriteStream,
): void {
  if (options.json) {
    stdout.write(`${JSON.stringify(files, null, 2)}\n`);
    return;
  }

  if (files.length === 0) {
    stdout.write("No files found.\n");
    return;
  }

  const rows: FileRow[] = files.map((file) => ({
    key: String(file.key ?? ""),
    name: String(file.name ?? ""),
    modified: String(file.last_modified ?? ""),
  }));

  const widths = {
    key: Math.max("Key".length, ...rows.map((row) => row.key.length)),
    name: Math.max("Name".length, ...rows.map((row) => row.name.length)),
    modified: Math.max(
      "Modified".length,
      ...rows.map((row) => row.modified.length),
    ),
  };

  const header = `${pad("Key", widths.key)}  ${pad("Name", widths.name)}  ${pad("Modified", widths.modified)}`;
  const divider = `${"-".repeat(widths.key)}  ${"-".repeat(widths.name)}  ${"-".repeat(widths.modified)}`;

  stdout.write(
    `${[
      header,
      divider,
      ...rows.map(
        (row) =>
          `${pad(row.key, widths.key)}  ${pad(row.name, widths.name)}  ${pad(row.modified, widths.modified)}`,
      ),
    ].join("\n")}\n`,
  );
}

interface PageRow {
  id: string;
  name: string;
}

interface ComponentSetRow {
  id: string;
  key: string;
  name: string;
}

function writeComponentSetProperties(
  properties: FigmaComponentSetProperty[],
  options: CliOptions,
  stdout: NodeJS.WriteStream,
): void {
  if (options.json) {
    stdout.write(`${JSON.stringify(properties, null, 2)}\n`);
    return;
  }

  if (properties.length === 0) {
    stdout.write("No component set properties found.\n");
    return;
  }

  const widths = {
    id: Math.max("ID".length, ...properties.map((property) => property.id.length)),
    name: Math.max(
      "Name".length,
      ...properties.map((property) => property.name.length),
    ),
    exposed: "Exposed".length,
  };

  const header = `${pad("ID", widths.id)}  ${pad("Name", widths.name)}  ${pad("Exposed", widths.exposed)}`;
  const divider = `${"-".repeat(widths.id)}  ${"-".repeat(widths.name)}  ${"-".repeat(widths.exposed)}`;

  stdout.write(
    `${[
      header,
      divider,
      ...properties.map((property) => {
        const exposed = property.isExposedInstance ? "true" : "false";
        return `${pad(property.id, widths.id)}  ${pad(property.name, widths.name)}  ${pad(exposed, widths.exposed)}`;
      }),
    ].join("\n")}\n`,
  );
}

function writeComponentSets(
  componentSets: FigmaComponentSet[],
  options: CliOptions,
  stdout: NodeJS.WriteStream,
): void {
  if (options.json) {
    stdout.write(`${JSON.stringify(componentSets, null, 2)}\n`);
    return;
  }

  if (componentSets.length === 0) {
    stdout.write("No component sets found.\n");
    return;
  }

  const rows: ComponentSetRow[] = componentSets.map((set) => ({
    id: set.id,
    key: set.key,
    name: set.name,
  }));

  const widths = {
    id: Math.max("ID".length, ...rows.map((row) => row.id.length)),
    key: Math.max("Key".length, ...rows.map((row) => row.key.length)),
    name: Math.max("Name".length, ...rows.map((row) => row.name.length)),
  };

  const header = `${pad("ID", widths.id)}  ${pad("Key", widths.key)}  ${pad("Name", widths.name)}`;
  const divider = `${"-".repeat(widths.id)}  ${"-".repeat(widths.key)}  ${"-".repeat(widths.name)}`;

  stdout.write(
    `${[
      header,
      divider,
      ...rows.map(
        (row) =>
          `${pad(row.id, widths.id)}  ${pad(row.key, widths.key)}  ${pad(row.name, widths.name)}`,
      ),
    ].join("\n")}\n`,
  );
}

function writePages(
  pages: FigmaPage[],
  options: CliOptions,
  stdout: NodeJS.WriteStream,
): void {
  if (options.json) {
    stdout.write(`${JSON.stringify(pages, null, 2)}\n`);
    return;
  }

  if (pages.length === 0) {
    stdout.write("No pages found.\n");
    return;
  }

  const rows: PageRow[] = pages.map((page) => ({
    id: String(page.id ?? ""),
    name: String(page.name ?? ""),
  }));

  const widths = {
    id: Math.max("ID".length, ...rows.map((row) => row.id.length)),
    name: Math.max("Name".length, ...rows.map((row) => row.name.length)),
  };

  const header = `${pad("ID", widths.id)}  ${pad("Name", widths.name)}`;
  const divider = `${"-".repeat(widths.id)}  ${"-".repeat(widths.name)}`;

  stdout.write(
    `${[
      header,
      divider,
      ...rows.map(
        (row) => `${pad(row.id, widths.id)}  ${pad(row.name, widths.name)}`,
      ),
    ].join("\n")}\n`,
  );
}

function pad(value: string, length: number): string {
  return value + " ".repeat(Math.max(0, length - value.length));
}

export class CliError extends Error {}
