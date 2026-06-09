import {
  FigmaApiError,
  getFileNode,
  listFileComponentSets,
  listFilePages,
  listProjectFiles,
  listTeamProjectFiles,
  listTeamProjects,
} from "../figma-api/index.js";
import {
  buildComponentSetSpecFromFile,
  FigmaInspectError,
  getNodeComponentSet,
  listAllComponentSets,
  listComponentSetProperties,
} from "../inspect/index.js";
import { CliError } from "./errors.js";
import {
  writeComponentSetProperties,
  writeComponentSets,
  writeFiles,
  writeJson,
  writePages,
  writeProjects,
  writeTeamComponentSets,
  writeTeamProjectFiles,
} from "./output.js";
import { parseCommand } from "./parse-args.js";
import type { CliIo } from "./types.js";
import { usage } from "./usage.js";

export async function runCli(argv: string[], io: CliIo): Promise<void> {
  const command = parseCommand(argv);

  if (command.kind === "help") {
    io.stdout.write(usage);
    return;
  }

  if (command.kind === "build-component-set-spec") {
    try {
      const spec = await buildComponentSetSpecFromFile(command.inputPath, {
        variablesPath: command.variablesPath,
      });
      writeJson(spec, io.stdout);
    } catch (error) {
      if (error instanceof FigmaInspectError) {
        throw new CliError(error.message);
      }

      throw error;
    }

    return;
  }

  const token = io.env.FIGMA_API_TOKEN;
  if (!token) {
    throw new CliError("Missing FIGMA_API_TOKEN environment variable.");
  }

  try {
    switch (command.kind) {
      case "list-team-projects": {
        const teamId = io.env.FIGMA_TEAM_ID;
        if (!teamId) {
          throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
        }

        const projects = await listTeamProjects({ token, teamId });
        writeProjects(projects, command.json, io.stdout);
        break;
      }
      case "list-team-project-files": {
        const teamId = io.env.FIGMA_TEAM_ID;
        if (!teamId) {
          throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
        }

        const files = await listTeamProjectFiles({ token, teamId });
        writeTeamProjectFiles(files, command.json, io.stdout);
        break;
      }
      case "list-team-component-sets": {
        const teamId = io.env.FIGMA_TEAM_ID;
        if (!teamId) {
          throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
        }

        const componentSets = await listAllComponentSets({ token, teamId });
        writeTeamComponentSets(componentSets, command.json, io.stdout);
        break;
      }
      case "list-project-files": {
        const files = await listProjectFiles({
          token,
          projectId: command.projectId,
        });
        writeFiles(files, command.json, io.stdout);
        break;
      }
      case "list-file-pages": {
        const pages = await listFilePages({
          token,
          fileKey: command.fileKey,
        });
        writePages(pages, command.json, io.stdout);
        break;
      }
      case "list-file-component-sets": {
        const publishedSets = await listFileComponentSets({
          token,
          fileKey: command.fileKey,
        });
        writeComponentSets(
          publishedSets
            .map((componentSet) => ({
              id: componentSet.node_id,
              key: componentSet.key,
              name: componentSet.name,
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
          command.json,
          io.stdout,
        );
        break;
      }
      case "inspect-component-set-properties": {
        const properties = await listComponentSetProperties({
          token,
          ...command.scope,
        });
        writeComponentSetProperties(properties, command.json, io.stdout);
        break;
      }
      case "inspect-component-set": {
        const componentSet = await getNodeComponentSet({
          token,
          ...command.scope,
        });
        writeJson(componentSet, io.stdout);
        break;
      }
      case "inspect-file-node": {
        const node = await getFileNode({
          token,
          fileKey: command.fileKey,
          nodeId: command.nodeId,
        });
        writeJson(node, io.stdout);
        break;
      }
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  } catch (error) {
    if (error instanceof FigmaApiError || error instanceof FigmaInspectError) {
      throw new CliError(error.message);
    }

    throw error;
  }
}
