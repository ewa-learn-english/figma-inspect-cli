export { loadComponentSetContext } from "./component-set-context.js";
export {
  buildComponentSetPseudocodeFromFile,
  buildComponentSetPseudocodeFromRaw,
  resolveGeometryContractPath,
  resolveMetaContractPath,
  resolveStructureDslPath,
  resolveVisualsContractPath,
} from "./component-set-pseudocode/index.js";
export { buildComponentSetSpecFromFile } from "./component-set-spec/index.js";
export { verifyComponentContracts } from "./contract/verify-component-contract.js";
export { FigmaInspectError } from "./errors.js";
export {
  DEFAULT_NESTED_ASSET_SCALE,
  exportNestedAssets,
  isNestedAssetNodeType,
  type NestedAssetFormat,
  type NestedAssetNodeType,
  type NestedAssetsOptions,
  supportedNestedAssetNodeTypes,
} from "./export/export-nested-assets.js";
export {
  DEFAULT_PREVIEW_SCALE,
  type ExportPreviewOptions,
  exportNodePreview,
  type PreviewFormat,
} from "./export/export-node-preview.js";
export { exportVariantAssets } from "./export/export-variant-assets.js";
export { resolveExportContractTarget } from "./export-contract-target.js";
export { parseFigmaNodeUrl } from "./figma-node-url.js";
export {
  getNodeComponentSet,
  getNodeComponentSetByRef,
} from "./get-node-component-set.js";
export { listAllComponentSets } from "./list-all-component-sets.js";
export {
  listComponentSetProperties,
  listComponentSetPropertiesByRef,
} from "./list-component-set-properties.js";
export {
  buildNodeContractFromRef,
  readNodeContractArtifacts,
  resolveNodeContractLockPath,
  resolveNodeGeometryContractPath,
  resolveNodeMetaContractPath,
  resolveNodeStructureDslPath,
  resolveNodeVisualsContractPath,
  validateNodeContractArtifacts,
  verifyNodeContracts,
  writeNodeContractLock,
} from "./node-contract/index.js";
export { resolveTeamComponentSetScope } from "./resolve-team-component-set.js";
