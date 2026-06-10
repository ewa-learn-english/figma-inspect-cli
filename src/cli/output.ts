import type {
  FigmaFile,
  FigmaPage,
  FigmaProject,
  FigmaTeamProjectFile,
} from "../figma-api/schemas.js";
import type { ContractFormat } from "../inspect/contract/contract-format.js";
import { serializeContractData } from "../inspect/contract/contract-format.js";
import type { FigmaComponentSet } from "../inspect/schemas.js";
import type {
  FigmaComponentSetProperty,
  FigmaTeamComponentSet,
} from "../inspect/types.js";

export function writeData(
  value: unknown,
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  stdout.write(serializeContractData(value, format));
}

export function writeProjects(
  projects: FigmaProject[],
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  writeData(projects, format, stdout);
}

export function writeFiles(
  files: FigmaFile[],
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  writeData(files, format, stdout);
}

export function writeTeamProjectFiles(
  files: FigmaTeamProjectFile[],
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  writeData(files, format, stdout);
}

export function writeComponentSetProperties(
  properties: FigmaComponentSetProperty[],
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  writeData(properties, format, stdout);
}

export function writeComponentSets(
  componentSets: FigmaComponentSet[],
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  writeData(componentSets, format, stdout);
}

export function writeTeamComponentSets(
  componentSets: FigmaTeamComponentSet[],
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  writeData(componentSets, format, stdout);
}

export function writePages(
  pages: FigmaPage[],
  format: ContractFormat,
  stdout: NodeJS.WriteStream,
): void {
  writeData(pages, format, stdout);
}
