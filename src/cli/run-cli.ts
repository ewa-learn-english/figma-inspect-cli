import { writeFile } from "node:fs/promises";
import path from "node:path";
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
  buildComponentSetPseudocodeFromFile,
  buildComponentSetSpecFromFile,
  FigmaInspectError,
  getNodeComponentSet,
  listAllComponentSets,
  listComponentSetProperties,
  resolveAssetsContractPath,
  resolveGeometryContractPath,
  resolveMetaContractPath,
  resolveStructureDslPath,
  resolveTeamComponentSetScope,
  resolveVisualsContractPath,
} from "../inspect/index.js";
import { CliError } from "./errors.js";
import {
  exportComponentSet,
  writeExportResult,
} from "./export-component-set.js";
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
        teamComponentsPath: command.teamComponentsPath,
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

  if (command.kind === "build-component-set-pseudocode") {
    try {
      const result = await buildComponentSetPseudocodeFromFile(
        command.inputPath,
        {
          variablesPath: command.variablesPath,
          teamComponentsPath: command.teamComponentsPath,
        },
      );
      const contractDirectory =
        command.outputDir ?? path.dirname(command.inputPath);
      const visualsContractPath = resolveVisualsContractPath(
        contractDirectory,
        result.componentName,
      );
      const geometryContractPath = resolveGeometryContractPath(
        contractDirectory,
        result.componentName,
      );
      const structureDslPath = resolveStructureDslPath(
        contractDirectory,
        result.componentName,
      );
      const metaContractPath = resolveMetaContractPath(
        contractDirectory,
        result.componentName,
      );
      await writeFile(
        visualsContractPath,
        `${JSON.stringify(result.visuals, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        geometryContractPath,
        `${JSON.stringify(result.geometry, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        metaContractPath,
        `${JSON.stringify(result.meta, null, 2)}\n`,
        "utf8",
      );
      if (result.assets) {
        const assetsContractPath = resolveAssetsContractPath(
          contractDirectory,
          result.componentName,
        );
        await writeFile(
          assetsContractPath,
          `${JSON.stringify(result.assets, null, 2)}\n`,
          "utf8",
        );
      }
      await writeFile(structureDslPath, result.structureDsl, "utf8");

      const outputLines = [
        visualsContractPath,
        geometryContractPath,
        metaContractPath,
        structureDslPath,
      ];
      if (result.assets) {
        outputLines.splice(
          3,
          0,
          resolveAssetsContractPath(contractDirectory, result.componentName),
        );
      }
      io.stdout.write(`${outputLines.join("\n")}\n`);
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

  if (command.kind === "export-component-set") {
    const teamId = io.env.FIGMA_TEAM_ID;
    if (!teamId) {
      throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
    }

    try {
      const result = await exportComponentSet({
        token,
        teamId,
        outputDir: command.outputDir,
        componentSet: command.componentSet,
        variablesPath: command.variablesPath,
        exportAssets: command.exportAssets,
        assetFormat: command.assetFormat,
      });
      writeExportResult(result, io.stdout);
    } catch (error) {
      if (
        error instanceof FigmaApiError ||
        error instanceof FigmaInspectError
      ) {
        throw new CliError(error.message);
      }

      throw error;
    }

    return;
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
      case "inspect-team-component-set": {
        const teamId = io.env.FIGMA_TEAM_ID;
        if (!teamId) {
          throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
        }

        const scope = await resolveTeamComponentSetScope({
          token,
          teamId,
          componentSet: command.componentSet,
        });
        const componentSet = await getNodeComponentSet({
          token,
          ...scope,
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
