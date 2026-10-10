import path from "node:path";
import {
  type BuildComponentSetSpecOptions,
  buildComponentSetSpecFromRaw,
  readComponentSetFile,
} from "../component-set-spec/build-spec.js";
import { loadTeamComponentRegistry } from "../component-set-spec/team-component-registry.js";
import type {
  ComponentSetSpec,
  SlimNode,
} from "../component-set-spec/types.js";
import {
  type ContractFormat,
  contractArtifactFileName,
} from "../contract/contract-format.js";
import { buildAssetBackedLayoutBundle } from "./asset-backed-contract.js";
import {
  type AssetContractMap,
  hasAssetContractMap,
} from "./assets-contract.js";
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
import { nodeKey } from "./slim-node-guards.js";
import { buildStructureContract } from "./structure-contract.js";
import { renderStructureDsl } from "./structure-dsl.js";
import { buildUniversalContracts } from "./universal.js";

export interface BuildComponentSetPseudocodeOptions
  extends BuildComponentSetSpecOptions {
  assetBacked?: boolean;
  assets?: AssetContractMap;
  metaContext?: MetaContractContext;
  format?: ContractFormat;
}

export interface ComponentSetContractResult {
  componentName: string;
  visuals: Record<string, unknown>;
  geometry: Record<string, unknown>;
  meta: MetaContract;
  structureDsl: string;
}

function structureDslFileName(componentName: string): string {
  return `${componentName}.component-set.structure.dsl`;
}

export function resolveVisualsContractPath(
  directory: string,
  componentName: string,
  format: ContractFormat = "yaml",
): string {
  return path.join(
    directory,
    contractArtifactFileName(componentName, "visuals", format),
  );
}

export function resolveGeometryContractPath(
  directory: string,
  componentName: string,
  format: ContractFormat = "yaml",
): string {
  return path.join(
    directory,
    contractArtifactFileName(componentName, "geometry", format),
  );
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
  format: ContractFormat = "yaml",
): string {
  return path.join(
    directory,
    contractArtifactFileName(componentName, "meta", format),
  );
}

function collectNodeKeys(node: SlimNode, keys: Set<string>, root = false) {
  keys.add(nodeKey(node, { root }));
  for (const child of node.children ?? []) {
    collectNodeKeys(child, keys);
  }
}

function normalizeLayoutNames(layout: SlimNode): SlimNode {
  const reservedKeys = new Set<string>();
  const usedKeys = new Set<string>();
  collectNodeKeys(layout, reservedKeys, true);

  const visit = (node: SlimNode, root = false): SlimNode => {
    const baseKey = nodeKey(node, { root });
    let key = baseKey;
    if (usedKeys.has(key)) {
      let suffix = 2;
      do {
        key = `${baseKey}${suffix}`;
        suffix += 1;
      } while (usedKeys.has(key) || reservedKeys.has(key));
    }
    usedKeys.add(key);
    return {
      ...node,
      ...(key === baseKey ? {} : { name: key }),
      ...(node.children
        ? { children: node.children.map((child) => visit(child)) }
        : {}),
    };
  };

  return visit(layout, true);
}

/**
 * Contract bundles are flat maps, so node keys must be unique across a whole
 * variant tree, including normalized-name collisions between nested siblings.
 */
function normalizeContractNodeNames(spec: ComponentSetSpec): ComponentSetSpec {
  return {
    ...spec,
    variants: spec.variants.map((variant) => ({
      ...variant,
      layout: normalizeLayoutNames(variant.layout),
    })),
  };
}

function buildComponentSetContracts(
  inputSpec: ComponentSetSpec,
  componentSet: Record<string, unknown>,
  metaContext?: MetaContractContext,
  options: Pick<
    BuildComponentSetPseudocodeOptions,
    "assetBacked" | "assets" | "format"
  > = {},
): ComponentSetContractResult {
  const spec = normalizeContractNodeNames(inputSpec);
  const assetBacked =
    options.assetBacked === true && hasAssetContractMap(options.assets);
  const model = buildPseudocodeModelFromSpec(spec);
  const format = options.format ?? "yaml";
  const contractName = metaContext?.component?.name ?? model.name;
  const outputModel =
    contractName === model.name ? model : { ...model, name: contractName };
  const structureDsl = renderStructureDsl(
    buildStructureContract(outputModel, spec, { assetBacked, format }),
  );
  const meta = buildMetaContract(componentSet, spec, metaContext);
  if (assetBacked && options.assets) {
    meta.assets = options.assets;
  }

  if (assetBacked) {
    const layout = buildAssetBackedLayoutBundle(spec);
    return {
      componentName: contractName,
      visuals: layout,
      geometry: layout,
      meta,
      structureDsl,
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
    componentName: contractName,
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
