import { access, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { FigmaInspectError } from "./errors.js";
import type {
  TeamIndexBundle,
  TeamIndexComponentUsage,
  TeamIndexFile,
} from "./team-index.js";
import type { ComponentSetLookup } from "./types.js";

export const TEAM_INDEX_DATABASE_FILE = "figma-index.sqlite3";

const TEAM_INDEX_SCHEMA_VERSION = "1";

export interface TeamIndexUsageRecord {
  file: TeamIndexFile["file"];
  screenGroups: TeamIndexFile["screenGroups"];
  usage: TeamIndexComponentUsage;
}

async function openDatabase(
  databasePath: string,
  options: { readOnly?: boolean; timeout?: number } = {},
): Promise<DatabaseSync> {
  let sqlite: typeof import("node:sqlite");
  try {
    sqlite = await import("node:sqlite");
  } catch {
    throw new FigmaInspectError(
      "Local team indexes require Node.js with node:sqlite support. Use Node.js 24 or newer.",
    );
  }

  return new sqlite.DatabaseSync(databasePath, {
    timeout: 5000,
    ...options,
  });
}

function rowString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new FigmaInspectError(`Invalid team index database row: ${key}.`);
  }

  return value;
}

function rowNullableString(
  row: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = row[key];
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new FigmaInspectError(`Invalid team index database row: ${key}.`);
  }

  return value;
}

function jsonText(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function nonEmptyJsonText(value: unknown[] | undefined): string | null {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (raw === undefined) {
    return fallback;
  }

  return JSON.parse(raw) as T;
}

function createSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = DELETE;

    CREATE TABLE metadata (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE files (
      file_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      project_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      component_set_count INTEGER NOT NULL,
      component_count INTEGER NOT NULL,
      screen_count INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE component_sets (
      file_key TEXT NOT NULL,
      node_id TEXT NOT NULL,
      component_key TEXT,
      name TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      url TEXT NOT NULL,
      PRIMARY KEY (file_key, node_id),
      FOREIGN KEY (file_key) REFERENCES files(file_key) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE components (
      file_key TEXT NOT NULL,
      node_id TEXT NOT NULL,
      component_key TEXT,
      name TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      url TEXT NOT NULL,
      PRIMARY KEY (file_key, node_id),
      FOREIGN KEY (file_key) REFERENCES files(file_key) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE screens (
      file_key TEXT NOT NULL,
      screen_id TEXT NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      group_id TEXT,
      last_modified TEXT NOT NULL,
      url TEXT NOT NULL,
      PRIMARY KEY (file_key, screen_id),
      FOREIGN KEY (file_key) REFERENCES files(file_key) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE screen_groups (
      file_key TEXT NOT NULL,
      group_id TEXT NOT NULL,
      PRIMARY KEY (file_key, group_id),
      FOREIGN KEY (file_key) REFERENCES files(file_key) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE screen_group_screens (
      file_key TEXT NOT NULL,
      group_id TEXT NOT NULL,
      screen_id TEXT NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      url TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (file_key, group_id, screen_id),
      FOREIGN KEY (file_key, group_id)
        REFERENCES screen_groups(file_key, group_id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE component_usages (
      usage_id INTEGER PRIMARY KEY,
      file_key TEXT NOT NULL,
      component_set_id TEXT NOT NULL,
      component_set_key TEXT,
      component_set_name TEXT NOT NULL,
      screen_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      instance_name TEXT NOT NULL,
      instance_path TEXT NOT NULL,
      variant_props_json TEXT,
      ancestor_chain_json TEXT NOT NULL,
      layout_risks_json TEXT,
      FOREIGN KEY (file_key) REFERENCES files(file_key) ON DELETE CASCADE,
      FOREIGN KEY (file_key, screen_id)
        REFERENCES screens(file_key, screen_id) ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX component_usages_component_set_key_idx
      ON component_usages(component_set_key);
    CREATE INDEX component_usages_component_set_name_idx
      ON component_usages(component_set_name);
    CREATE INDEX component_usages_screen_idx
      ON component_usages(file_key, screen_id);
    CREATE INDEX screens_group_idx
      ON screens(file_key, group_id);
  `);
}

function insertIndex(database: DatabaseSync, index: TeamIndexBundle): void {
  const insertMetadata = database.prepare(
    "INSERT INTO metadata (name, value) VALUES (?, ?)",
  );
  insertMetadata.run("schema_version", TEAM_INDEX_SCHEMA_VERSION);
  insertMetadata.run("kind", "figma-team-index");
  insertMetadata.run("team", index.team.team);
  insertMetadata.run("version", String(index.team.version));

  const insertFile = database.prepare(`
    INSERT INTO files (
      file_key,
      name,
      last_modified,
      project_id,
      project_name,
      component_set_count,
      component_count,
      screen_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNode = database.prepare(`
    INSERT INTO component_sets (
      file_key,
      node_id,
      component_key,
      name,
      last_modified,
      url
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertComponent = database.prepare(`
    INSERT INTO components (
      file_key,
      node_id,
      component_key,
      name,
      last_modified,
      url
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertScreen = database.prepare(`
    INSERT INTO screens (
      file_key,
      screen_id,
      name,
      size,
      group_id,
      last_modified,
      url
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertScreenGroup = database.prepare(
    "INSERT INTO screen_groups (file_key, group_id) VALUES (?, ?)",
  );
  const insertScreenGroupScreen = database.prepare(`
    INSERT INTO screen_group_screens (
      file_key,
      group_id,
      screen_id,
      name,
      size,
      last_modified,
      url,
      position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertUsage = database.prepare(`
    INSERT INTO component_usages (
      file_key,
      component_set_id,
      component_set_key,
      component_set_name,
      screen_id,
      instance_id,
      instance_name,
      instance_path,
      variant_props_json,
      ancestor_chain_json,
      layout_risks_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");
  try {
    for (const file of index.files) {
      insertFile.run(
        file.file.key,
        file.file.name,
        file.file.lastModified,
        file.file.projectId,
        file.file.projectName,
        file.componentSets.length,
        file.components.length,
        file.screens.length,
      );

      for (const componentSet of file.componentSets) {
        insertNode.run(
          file.file.key,
          componentSet.id,
          componentSet.key ?? null,
          componentSet.name,
          componentSet.lastModified,
          componentSet.url,
        );
      }

      for (const component of file.components) {
        insertComponent.run(
          file.file.key,
          component.id,
          component.key ?? null,
          component.name,
          component.lastModified,
          component.url,
        );
      }

      for (const screen of file.screens) {
        insertScreen.run(
          file.file.key,
          screen.id,
          screen.name,
          screen.size,
          screen.group,
          screen.lastModified,
          screen.url,
        );
      }

      for (const group of file.screenGroups) {
        insertScreenGroup.run(file.file.key, group.id);
        group.screens.forEach((screen, index) => {
          insertScreenGroupScreen.run(
            file.file.key,
            group.id,
            screen.id,
            screen.name,
            screen.size,
            screen.lastModified,
            screen.url,
            index,
          );
        });
      }

      for (const usage of file.componentUsages) {
        insertUsage.run(
          file.file.key,
          usage.componentSet.id,
          usage.componentSet.key ?? null,
          usage.componentSet.name,
          usage.screen.id,
          usage.instance.id,
          usage.instance.name,
          usage.instance.path,
          jsonText(usage.instance.variantProps),
          JSON.stringify(usage.ancestorChain),
          nonEmptyJsonText(usage.layoutRisks),
        );
      }
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function writeTeamIndexDatabase({
  databasePath,
  index,
}: {
  databasePath: string;
  index: TeamIndexBundle;
}): Promise<void> {
  await mkdir(path.dirname(databasePath), { recursive: true });
  const temporaryPath = `${databasePath}.tmp-${process.pid}-${Date.now()}`;
  await rm(temporaryPath, { force: true });

  let movedIntoPlace = false;
  try {
    const database = await openDatabase(temporaryPath);
    try {
      createSchema(database);
      insertIndex(database, index);
      database.exec("PRAGMA optimize");
      database.exec("VACUUM");
    } finally {
      database.close();
    }

    await rm(databasePath, { force: true });
    await rename(temporaryPath, databasePath);
    movedIntoPlace = true;
  } finally {
    if (!movedIntoPlace) {
      await rm(temporaryPath, { force: true });
    }
  }
}

async function hasLegacyYamlIndex(indexDir: string): Promise<boolean> {
  try {
    const entries = await readdir(indexDir, { withFileTypes: true });
    return entries.some(
      (entry) =>
        entry.isFile() &&
        (entry.name === "team.index.yaml" ||
          (entry.name.endsWith(".index.yaml") &&
            entry.name !== TEAM_INDEX_DATABASE_FILE)),
    );
  } catch {
    return false;
  }
}

async function resolveDatabasePath(indexDir: string): Promise<string> {
  const databasePath = indexDir.endsWith(".sqlite3")
    ? indexDir
    : path.join(indexDir, TEAM_INDEX_DATABASE_FILE);

  try {
    await access(databasePath);
    return databasePath;
  } catch {
    if (await hasLegacyYamlIndex(indexDir)) {
      throw new FigmaInspectError(
        "Local team index uses the removed YAML format. Rerun figma-inspect --export-team-index to create figma-index.sqlite3.",
      );
    }

    throw new FigmaInspectError(
      `No ${TEAM_INDEX_DATABASE_FILE} found in ${indexDir}. Rerun figma-inspect --export-team-index.`,
    );
  }
}

function assertDatabaseMetadata(
  database: DatabaseSync,
  databasePath: string,
): void {
  const schemaVersion = database
    .prepare("SELECT value FROM metadata WHERE name = ?")
    .get("schema_version");
  if (!schemaVersion || schemaVersion.value !== TEAM_INDEX_SCHEMA_VERSION) {
    throw new FigmaInspectError(
      `Unsupported Figma team index database ${path.basename(databasePath)}.`,
    );
  }

  const kind = database
    .prepare("SELECT value FROM metadata WHERE name = ?")
    .get("kind");
  if (kind?.value !== "figma-team-index") {
    throw new FigmaInspectError(
      `Invalid Figma team index database ${path.basename(databasePath)}.`,
    );
  }
}

function readScreenGroupsByFile(
  database: DatabaseSync,
  fileKeys: readonly string[],
): Map<string, TeamIndexFile["screenGroups"]> {
  if (fileKeys.length === 0) {
    return new Map();
  }

  const placeholders = fileKeys.map(() => "?").join(", ");
  const rows = database
    .prepare(`
      SELECT
        file_key,
        group_id,
        screen_id,
        name,
        size,
        last_modified,
        url
      FROM screen_group_screens
      WHERE file_key IN (${placeholders})
      ORDER BY file_key, group_id, position, screen_id
    `)
    .all(...fileKeys) as Record<string, unknown>[];

  const groupsByFile = new Map<
    string,
    Map<string, TeamIndexFile["screenGroups"][number]>
  >();

  for (const row of rows) {
    const fileKey = rowString(row, "file_key");
    const groupId = rowString(row, "group_id");
    const fileGroups = groupsByFile.get(fileKey) ?? new Map();
    const group = fileGroups.get(groupId) ?? { id: groupId, screens: [] };
    group.screens.push({
      id: rowString(row, "screen_id"),
      name: rowString(row, "name"),
      size: rowString(row, "size"),
      lastModified: rowString(row, "last_modified"),
      url: rowString(row, "url"),
    });
    fileGroups.set(groupId, group);
    groupsByFile.set(fileKey, fileGroups);
  }

  return new Map(
    [...groupsByFile.entries()].map(([fileKey, groups]) => [
      fileKey,
      [...groups.values()],
    ]),
  );
}

function usageFromRow(row: Record<string, unknown>): TeamIndexComponentUsage {
  const componentSetKey = rowNullableString(row, "component_set_key");
  const variantProps = parseJson<Record<string, boolean | string> | undefined>(
    rowNullableString(row, "variant_props_json"),
    undefined,
  );
  const layoutRisks = parseJson<TeamIndexComponentUsage["layoutRisks"]>(
    rowNullableString(row, "layout_risks_json"),
    undefined,
  );

  return {
    componentSet: {
      id: rowString(row, "component_set_id"),
      ...(componentSetKey ? { key: componentSetKey } : {}),
      name: rowString(row, "component_set_name"),
    },
    screen: {
      id: rowString(row, "screen_id"),
      name: rowString(row, "screen_name"),
      size: rowString(row, "screen_size"),
      group: rowNullableString(row, "screen_group") ?? null,
      lastModified: rowString(row, "screen_last_modified"),
      url: rowString(row, "screen_url"),
    },
    instance: {
      id: rowString(row, "instance_id"),
      name: rowString(row, "instance_name"),
      path: rowString(row, "instance_path"),
      ...(variantProps ? { variantProps } : {}),
    },
    ancestorChain: parseJson(rowNullableString(row, "ancestor_chain_json"), []),
    ...(layoutRisks ? { layoutRisks } : {}),
  };
}

function fileFromRow(row: Record<string, unknown>): TeamIndexFile["file"] {
  return {
    key: rowString(row, "file_key"),
    name: rowString(row, "file_name"),
    lastModified: rowString(row, "file_last_modified"),
    projectId: rowString(row, "project_id"),
    projectName: rowString(row, "project_name"),
  };
}

export async function readComponentUsageRecords({
  indexDir,
  componentSet,
}: {
  indexDir: string;
  componentSet: ComponentSetLookup;
}): Promise<TeamIndexUsageRecord[]> {
  const databasePath = await resolveDatabasePath(indexDir);
  const database = await openDatabase(databasePath, { readOnly: true });
  try {
    assertDatabaseMetadata(database, databasePath);
    const where =
      componentSet.kind === "key"
        ? "u.component_set_key = ?"
        : "u.component_set_name = ?";
    const rows = database
      .prepare(`
        SELECT
          f.file_key,
          f.name AS file_name,
          f.last_modified AS file_last_modified,
          f.project_id,
          f.project_name,
          u.component_set_id,
          u.component_set_key,
          u.component_set_name,
          s.screen_id,
          s.name AS screen_name,
          s.size AS screen_size,
          s.group_id AS screen_group,
          s.last_modified AS screen_last_modified,
          s.url AS screen_url,
          u.instance_id,
          u.instance_name,
          u.instance_path,
          u.variant_props_json,
          u.ancestor_chain_json,
          u.layout_risks_json
        FROM component_usages u
        INNER JOIN files f ON f.file_key = u.file_key
        INNER JOIN screens s
          ON s.file_key = u.file_key AND s.screen_id = u.screen_id
        WHERE ${where}
        ORDER BY f.file_key, s.screen_id, u.instance_path
      `)
      .all(componentSet.value) as Record<string, unknown>[];

    const fileKeys = [
      ...new Set(rows.map((row) => rowString(row, "file_key"))),
    ];
    const screenGroupsByFile = readScreenGroupsByFile(database, fileKeys);

    return rows.map((row) => {
      const file = fileFromRow(row);
      return {
        file,
        screenGroups: screenGroupsByFile.get(file.key) ?? [],
        usage: usageFromRow(row),
      };
    });
  } catch (error) {
    if (error instanceof FigmaInspectError) {
      throw error;
    }

    throw new FigmaInspectError(
      `Invalid Figma team index database ${path.basename(databasePath)}.`,
    );
  } finally {
    database.close();
  }
}
