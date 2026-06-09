import {
  FigmaApiError,
  getFileNode,
  listFilePages,
  listProjectFiles,
  listTeamProjects,
} from "./figma-api/index.js";
import type { FigmaFile, FigmaPage, FigmaProject } from "./figma-api/types.js";

const usage = `Usage:
  figma-inspect --list-projects [--json]
  figma-inspect --list-project-files --project-id <id> [--json]
  figma-inspect --list-pages --file-key <key> [--json]
  figma-inspect --inspect-node --file-key <key> --node-id <id>

Environment:
  FIGMA_API_TOKEN  Figma personal access token
  FIGMA_TEAM_ID    Figma team id (required for --list-projects)

Options:
  --list-projects       List projects in a Figma team
  --list-project-files  List files in a Figma project
  --list-pages          List pages in a Figma file
  --inspect-node        Print raw JSON for a file node
  --project-id <id>     Project id (required with --list-project-files)
  --file-key <key>      File key (required with --list-pages and --inspect-node)
  --node-id <id>        Node id (required with --inspect-node)
  --json                Print JSON instead of a table
  --help, -h            Show this help message
`;

export interface CliOptions {
  help: boolean;
  listProjects: boolean;
  listProjectFiles: boolean;
  listPages: boolean;
  inspectNode: boolean;
  projectId: string | undefined;
  fileKey: string | undefined;
  nodeId: string | undefined;
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
    !options.inspectNode
  ) {
    throw new CliError(
      "Nothing to do. Pass --list-projects, --list-project-files, --list-pages, or --inspect-node.\n\n" +
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
    inspectNode: false,
    projectId: undefined,
    fileKey: undefined,
    nodeId: undefined,
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
