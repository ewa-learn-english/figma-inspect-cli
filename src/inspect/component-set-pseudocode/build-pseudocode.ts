import path from "node:path";
import {
  type BuildComponentSetSpecOptions,
  buildComponentSetSpecFromFile,
} from "../component-set-spec/build-spec.js";
import { buildPseudocodeModelFromSpec } from "./infer.js";
import { buildStructureContract } from "./structure-contract.js";
import { renderStructureDsl } from "./structure-dsl.js";
import { buildUniversalContracts } from "./universal.js";

export interface ComponentSetContractResult {
  componentName: string;
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
  structureDsl: string;
}

function visualsContractFileName(componentName: string): string {
  return `${componentName}.contract.visuals.json`;
}

function geometryContractFileName(componentName: string): string {
  return `${componentName}.contract.geometry.json`;
}

function structureDslFileName(componentName: string): string {
  return `${componentName}.contract.structure.dsl`;
}

export function resolveVisualsContractPath(
  directory: string,
  componentName: string,
): string {
  return path.join(directory, visualsContractFileName(componentName));
}

export function resolveGeometryContractPath(
  directory: string,
  componentName: string,
): string {
  return path.join(directory, geometryContractFileName(componentName));
}

export function resolveStructureDslPath(
  directory: string,
  componentName: string,
): string {
  return path.join(directory, structureDslFileName(componentName));
}

function buildComponentSetContracts(
  spec: Awaited<ReturnType<typeof buildComponentSetSpecFromFile>>,
): ComponentSetContractResult {
  const model = buildPseudocodeModelFromSpec(spec);
  const { visuals, geometry } = buildUniversalContracts(model);
  const structureDsl = renderStructureDsl(buildStructureContract(model, spec));

  return {
    componentName: model.name,
    visuals,
    geometry,
    structureDsl,
  };
}

export async function buildComponentSetPseudocodeFromFile(
  inputPath: string,
  options: BuildComponentSetSpecOptions = {},
): Promise<ComponentSetContractResult> {
  const spec = await buildComponentSetSpecFromFile(inputPath, options);
  return buildComponentSetContracts(spec);
}
