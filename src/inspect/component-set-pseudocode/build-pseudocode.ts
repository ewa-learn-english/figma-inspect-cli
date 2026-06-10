import path from "node:path";
import {
  type BuildComponentSetSpecOptions,
  buildComponentSetSpecFromRaw,
  readComponentSetFile,
} from "../component-set-spec/build-spec.js";
import { loadTeamComponentRegistry } from "../component-set-spec/team-component-registry.js";
import {
  buildAssetBackedGeometry,
  buildAssetBackedVisuals,
  hasAssetMapAssets,
} from "./asset-backed-contract.js";
import type { AssetContractMap } from "./assets-contract.js";
import {
  buildBaselineContracts,
  mergeBaselineWithVariantContracts,
} from "./baseline-contract.js";
import { buildPseudocodeModelFromSpec } from "./infer.js";
import {
  buildMetaContract,
  type MetaContract,
  type MetaContractContext,
} from "./meta-contract.js";
import { buildStructureContract } from "./structure-contract.js";
import { renderStructureDsl } from "./structure-dsl.js";
import { buildUniversalContracts } from "./universal.js";

export interface BuildComponentSetPseudocodeOptions
  extends BuildComponentSetSpecOptions {
  assetBacked?: boolean;
  assets?: AssetContractMap;
  metaContext?: MetaContractContext;
}

export interface ComponentSetContractResult {
  componentName: string;
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
  meta: MetaContract;
  structureDsl: string;
  assets?: AssetContractMap;
}

function visualsContractFileName(componentName: string): string {
  return `${componentName}.contract.visuals.json`;
}

function geometryContractFileName(componentName: string): string {
  return `${componentName}.contract.geometry.json`;
}

function assetsContractFileName(componentName: string): string {
  return `${componentName}.contract.assets.json`;
}

function structureDslFileName(componentName: string): string {
  return `${componentName}.contract.structure.dsl`;
}

function metaContractFileName(componentName: string): string {
  return `${componentName}.contract.meta.json`;
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

export function resolveAssetsContractPath(
  directory: string,
  componentName: string,
): string {
  return path.join(directory, assetsContractFileName(componentName));
}

export function resolveStructureDslPath(
  directory: string,
  componentName: string,
): string {
  return path.join(directory, structureDslFileName(componentName));
}

export function resolveMetaContractPath(
  directory: string,
  componentName: string,
): string {
  return path.join(directory, metaContractFileName(componentName));
}

function buildComponentSetContracts(
  spec: Awaited<ReturnType<typeof buildComponentSetSpecFromRaw>>,
  componentSet: Record<string, unknown>,
  metaContext?: MetaContractContext,
  options: Pick<
    BuildComponentSetPseudocodeOptions,
    "assetBacked" | "assets"
  > = {},
): ComponentSetContractResult {
  const assetBacked =
    options.assetBacked === true && hasAssetMapAssets(options.assets);
  const model = buildPseudocodeModelFromSpec(spec);
  const structureDsl = renderStructureDsl(
    buildStructureContract(model, spec, { assetBacked }),
  );
  const meta = buildMetaContract(componentSet, spec, metaContext);

  if (assetBacked) {
    return {
      componentName: model.name,
      visuals: buildAssetBackedVisuals(spec),
      geometry: buildAssetBackedGeometry(spec),
      meta,
      structureDsl,
      assets: options.assets,
    };
  }

  const variantContracts = buildUniversalContracts(model);
  const baseline = buildBaselineContracts(spec, model);
  const axesDepth = Object.keys(model.variantAxes).length;
  const { visuals, geometry } = mergeBaselineWithVariantContracts(
    baseline,
    variantContracts,
    axesDepth,
  );

  return {
    componentName: model.name,
    visuals,
    geometry,
    meta,
    structureDsl,
  };
}

async function resolveMetaContext(
  options: BuildComponentSetPseudocodeOptions,
): Promise<MetaContractContext | undefined> {
  if (options.metaContext) {
    return options.metaContext;
  }

  if (!options.teamComponentsPath) {
    return undefined;
  }

  return {
    teamComponents: await loadTeamComponentRegistry(options.teamComponentsPath),
  };
}

export async function buildComponentSetPseudocodeFromFile(
  inputPath: string,
  options: BuildComponentSetPseudocodeOptions = {},
): Promise<ComponentSetContractResult> {
  const componentSet = await readComponentSetFile(inputPath);
  const spec = await buildComponentSetSpecFromRaw(componentSet, options);
  const metaContext = await resolveMetaContext(options);
  return buildComponentSetContracts(spec, componentSet, metaContext, options);
}

export async function buildComponentSetPseudocodeFromRaw(
  componentSet: Record<string, unknown>,
  options: BuildComponentSetPseudocodeOptions = {},
): Promise<ComponentSetContractResult> {
  const spec = await buildComponentSetSpecFromRaw(componentSet, options);
  const metaContext = await resolveMetaContext(options);
  return buildComponentSetContracts(spec, componentSet, metaContext, options);
}
