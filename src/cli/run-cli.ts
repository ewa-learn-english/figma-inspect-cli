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
import { serializeContractData } from "../inspect/contract/contract-format.js";
import {
  buildComponentSetPseudocodeFromFile,
  buildComponentSetSpecFromFile,
  FigmaInspectError,
  getNodeComponentSet,
  getNodeComponentSetByRef,
  listAllComponentSets,
  listComponentSetProperties,
  listComponentSetPropertiesByRef,
  resolveGeometryContractPath,
  resolveMetaContractPath,
  resolveStructureDslPath,
  resolveTeamComponentSetScope,
  resolveVisualsContractPath,
  verifyComponentContracts,
  verifyNodeContracts,
} from "../inspect/index.js";
import { CliError } from "./errors.js";
import { exportComponentSet } from "./export-component-set.js";
import { exportContract } from "./export-contract.js";
import { exportNodeContract } from "./export-node-contract.js";
import { writeExportArtifactPaths } from "./export-result.js";
import { exportTeamIndex } from "./export-team-index.js";
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

  if (command.kind === "verify-node-contract") {
    const token = io.env.FIGMA_API_TOKEN;
    if (!token) {
      throw new CliError("Missing FIGMA_API_TOKEN environment variable.");
    }

    try {
      const results = await verifyNodeContracts({
        token,
        contractDir: command.contractDir,
        nodeName: command.nodeName,
        contractFormat: command.contractFormat,
      });
      if (command.outputFormat === "json") {
        io.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
      } else {
        for (const result of results) {
          io.stdout.write(
            `${result.nodeName}\t${result.kind}\t${result.status}\n`,
          );
          for (const error of result.errors) {
            io.stdout.write(`  ${error}\n`);
          }
          if (result.status === "changed") {
            const parts: string[] = [];
            if (result.changed.source) {
              parts.push("source");
            }
            if (result.changed.tree) {
              parts.push("tree");
            }
            if (result.changed.contractSurface) {
              parts.push("contract-surface");
            }
            if (result.changed.kind) {
              parts.push("kind");
            }
            io.stdout.write(`  changed: ${parts.join(" ")}\n`);
          }
        }
      }

      if (results.some((result) => result.status !== "ok")) {
        throw new CliError("Node contract verification failed.");
      }
    } catch (error) {
      if (error instanceof FigmaInspectError || error instanceof CliError) {
        throw error instanceof CliError ? error : new CliError(error.message);
      }

      throw error;
    }

    return;
  }

  if (command.kind === "verify-component-contract") {
    const token = io.env.FIGMA_API_TOKEN;
    if (!token) {
      throw new CliError("Missing FIGMA_API_TOKEN environment variable.");
    }

    try {
      const results = await verifyComponentContracts({
        token,
        contractDir: command.contractDir,
        componentName: command.componentName,
        contractFormat: command.contractFormat,
      });
      if (command.outputFormat === "json") {
        io.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
      } else {
        for (const result of results) {
          io.stdout.write(`${result.componentName}\t${result.status}\n`);
          for (const error of result.errors) {
            io.stdout.write(`  ${error}\n`);
          }
          if (result.status === "changed") {
            const parts: string[] = [];
            if (result.changed.source) {
              parts.push("source");
            }
            if (result.changed.tree) {
              parts.push("tree");
            }
            if (result.changed.contractSurface) {
              parts.push("contract-surface");
            }
            if (result.changed.variants.length > 0) {
              parts.push(`variants=${result.changed.variants.join(", ")}`);
            }
            if (result.changed.addedVariants.length > 0) {
              parts.push(`added=${result.changed.addedVariants.join(", ")}`);
            }
            if (result.changed.removedVariants.length > 0) {
              parts.push(
                `removed=${result.changed.removedVariants.join(", ")}`,
              );
            }
            io.stdout.write(`  changed: ${parts.join(" ")}\n`);
          }
        }
      }

      if (results.some((result) => result.status !== "ok")) {
        throw new CliError("Contract verification failed.");
      }
    } catch (error) {
      if (error instanceof FigmaInspectError || error instanceof CliError) {
        throw error instanceof CliError ? error : new CliError(error.message);
      }

      throw error;
    }

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
      await writeFile(structureDslPath, result.structureDsl, "utf8");

      io.stdout.write(
        `${[
          visualsContractPath,
          geometryContractPath,
          metaContractPath,
          structureDslPath,
        ].join("\n")}\n`,
      );
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

  if (command.kind === "export-team-index") {
    const teamId = io.env.FIGMA_TEAM_ID;
    if (!teamId) {
      throw new CliError("Missing FIGMA_TEAM_ID environment variable.");
    }

    try {
      const result = await exportTeamIndex({
        token,
        teamId,
        outputDir: command.outputDir,
        screenSimilarityThreshold: command.screenSimilarityThreshold,
        screenSizeTolerance: command.screenSizeTolerance,
      });
      io.stdout.write(
        `${[result.teamIndexPath, ...result.fileIndexPaths].join("\n")}\n`,
      );
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
        sourceUrl: command.sourceUrl,
        variablesPath: command.variablesPath,
        exportAssets: command.exportAssets,
        assetFormat: command.assetFormat,
        nestedAssets: command.nestedAssets,
        preview: command.preview,
        format: command.format,
      });
      writeExportArtifactPaths(result, io.stdout);
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

  if (command.kind === "export-contract") {
    try {
      const result = await exportContract({
        token,
        teamId: io.env.FIGMA_TEAM_ID,
        outputDir: command.outputDir,
        fileKey: command.fileKey,
        nodeId: command.nodeId,
        sourceUrl: command.sourceUrl,
        variablesPath: command.variablesPath,
        exportAssets: command.exportAssets,
        assetFormat: command.assetFormat,
        nestedAssets: command.nestedAssets,
        preview: command.preview,
        format: command.format,
      });
      writeExportArtifactPaths(result, io.stdout);
    } catch (error) {
      if (
        error instanceof CliError ||
        error instanceof FigmaApiError ||
        error instanceof FigmaInspectError
      ) {
        throw error instanceof CliError ? error : new CliError(error.message);
      }

      throw error;
    }

    return;
  }

  if (command.kind === "export-node-contract") {
    try {
      const result = await exportNodeContract({
        token,
        outputDir: command.outputDir,
        fileKey: command.fileKey,
        nodeId: command.nodeId,
        sourceUrl: command.sourceUrl,
        variablesPath: command.variablesPath,
        nestedAssets: command.nestedAssets,
        preview: command.preview,
        format: command.format,
      });
      writeExportArtifactPaths(result, io.stdout);
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
        const properties =
          command.scope.kind === "node"
            ? await listComponentSetPropertiesByRef({
                token,
                fileKey: command.scope.fileKey,
                nodeId: command.scope.nodeId,
              })
            : await listComponentSetProperties({
                token,
                fileKey: command.scope.fileKey,
                nodeId: command.scope.nodeId,
                componentSet: command.scope.componentSet,
              });
        writeComponentSetProperties(properties, command.format, io.stdout);
        break;
      }
      case "inspect-component-set": {
        const componentSet =
          command.scope.kind === "node"
            ? await getNodeComponentSetByRef({
                token,
                fileKey: command.scope.fileKey,
                nodeId: command.scope.nodeId,
              })
            : await getNodeComponentSet({
                token,
                fileKey: command.scope.fileKey,
                nodeId: command.scope.nodeId,
                componentSet: command.scope.componentSet,
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
