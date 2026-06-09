import type {
  FigmaFile,
  FigmaPage,
  FigmaProject,
  FigmaTeamProjectFile,
} from "../figma-api/schemas.js";
import type { FigmaComponentSet } from "../inspect/schemas.js";
import type { FigmaComponentSetProperty } from "../inspect/types.js";
import { formatTable, writeJsonOrTable } from "./format-table.js";

export function writeJson(value: unknown, stdout: NodeJS.WriteStream): void {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

interface ProjectRow {
  id: string;
  name: string;
  files: string;
}

export function writeProjects(
  projects: FigmaProject[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(projects, json, stdout, "No projects found.", (items) => {
    const rows: ProjectRow[] = items.map((project) => ({
      id: project.id,
      name: project.name,
      files: project.file_count === undefined ? "" : String(project.file_count),
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

export function writeFiles(
  files: FigmaFile[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(files, json, stdout, "No files found.", (items) => {
    const rows: FileRow[] = items.map((file) => ({
      key: file.key,
      name: file.name,
      modified: file.last_modified,
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

interface TeamProjectFileRow {
  key: string;
  name: string;
  modified: string;
  projectId: string;
  projectName: string;
}

export function writeTeamProjectFiles(
  files: FigmaTeamProjectFile[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(files, json, stdout, "No files found.", (items) => {
    const rows: TeamProjectFileRow[] = items.map((file) => ({
      key: file.key,
      name: file.name,
      modified: file.last_modified,
      projectId: file.project_id,
      projectName: file.project_name,
    }));

    return formatTable(
      [
        { header: "Key", value: (row: TeamProjectFileRow) => row.key },
        { header: "Name", value: (row: TeamProjectFileRow) => row.name },
        {
          header: "Modified",
          value: (row: TeamProjectFileRow) => row.modified,
        },
        {
          header: "Project ID",
          value: (row: TeamProjectFileRow) => row.projectId,
        },
        {
          header: "Project",
          value: (row: TeamProjectFileRow) => row.projectName,
        },
      ],
      rows,
    );
  });
}

export function writeComponentSetProperties(
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

export function writeComponentSets(
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

export function writePages(
  pages: FigmaPage[],
  json: boolean,
  stdout: NodeJS.WriteStream,
): void {
  writeJsonOrTable(pages, json, stdout, "No pages found.", (items) => {
    const rows = items.map((page) => ({
      id: page.id,
      name: page.name,
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
