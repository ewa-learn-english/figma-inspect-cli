export interface AssetContractEntry {
  path: string;
  format: "svg";
}

export interface AssetContractMap {
  [axisValue: string]: AssetContractEntry | AssetContractMap;
}

export function hasAssetContractMap(
  assets: AssetContractMap | undefined,
): assets is AssetContractMap {
  return assets != null && Object.keys(assets).length > 0;
}
