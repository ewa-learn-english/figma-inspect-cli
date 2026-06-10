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
import { serializeContractData } from "../inspect/contract-format.js";
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
  writeData,
  writeFiles,
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
      writeData(spec, command.format, io.stdout);
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
          format: command.format,
        },
      );
      const contractDirectory =
        command.outputDir ?? path.dirname(command.inputPath);
      const visualsContractPath = resolveVisualsContractPath(
        contractDirectory,
        result.componentName,
        command.format,
      );
      const geometryContractPath = resolveGeometryContractPath(
        contractDirectory,
        result.componentName,
        command.format,
      );
      const structureDslPath = resolveStructureDslPath(
        contractDirectory,
        result.componentName,
      );
      const metaContractPath = resolveMetaContractPath(
        contractDirectory,
        result.componentName,
        command.format,
      );
      await writeFile(
        visualsContractPath,
        serializeContractData(result.visuals, command.format),
        "utf8",
      );
      await writeFile(
        geometryContractPath,
        serializeContractData(result.geometry, command.format),
        "utf8",
      );
      await writeFile(
        metaContractPath,
        serializeContractData(result.meta, command.format),
        "utf8",
      );
      if (result.assets) {
        const assetsContractPath = resolveAssetsContractPath(
          contractDirectory,
          result.componentName,
          command.format,
        );
        await writeFile(
          assetsContractPath,
          serializeContractData(result.assets, command.format),
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
          resolveAssetsContractPath(
            contractDirectory,
            result.componentName,
            command.format,
          ),
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
        format: command.format,
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
        writeProjects(projects, command.format, io.stdout);
        break;
      }
      case "list-team-project-files": {
        const teamId = io.env.FIGMA_TEAM_ID;
        if (!teamId) {
          throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
        }

        const files = await listTeamProjectFiles({ token, teamId });
        writeTeamProjectFiles(files, command.format, io.stdout);
        break;
      }
      case "list-team-component-sets": {
        const teamId = io.env.FIGMA_TEAM_ID;
        if (!teamId) {
          throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
        }

        const componentSets = await listAllComponentSets({ token, teamId });
        writeTeamComponentSets(componentSets, command.format, io.stdout);
        break;
      }
      case "list-project-files": {
        const files = await listProjectFiles({
          token,
          projectId: command.projectId,
        });
        writeFiles(files, command.format, io.stdout);
        break;
      }
      case "list-file-pages": {
        const pages = await listFilePages({
          token,
          fileKey: command.fileKey,
        });
        writePages(pages, command.format, io.stdout);
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
          command.format,
          io.stdout,
        );
        break;
      }
      case "inspect-component-set-properties": {
        const properties = await listComponentSetProperties({
          token,
          ...command.scope,
        });
        writeComponentSetProperties(properties, command.format, io.stdout);
        break;
      }
      case "inspect-component-set": {
        const componentSet = await getNodeComponentSet({
          token,
          ...command.scope,
        });
        writeData(componentSet, command.format, io.stdout);
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
        writeData(componentSet, command.format, io.stdout);
        break;
      }
      case "inspect-file-node": {
        const node = await getFileNode({
          token,
          fileKey: command.fileKey,
          nodeId: command.nodeId,
        });
        writeData(node, command.format, io.stdout);
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
